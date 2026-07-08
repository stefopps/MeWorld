/** Extract a spoiler-safe visual brief for portrait generation (director + clinician). */

const DIAGNOSIS_BLOCKLIST =
  /\b(diagnosis|diabetic ketoacidosis|dka|myocardial infarction|sepsis|pneumonia|appendicitis|endometriosis)\b/gi;

function clip(text, max = 400) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function chatSnippet(chatMessages = [], limit = 12) {
  return (Array.isArray(chatMessages) ? chatMessages : [])
    .filter((m) => m?.content && (m.role === 'user' || m.role === 'assistant' || m.role === 'patient'))
    .slice(-limit)
    .map((m) => `${m.role}: ${clip(m.content, 220)}`)
    .join('\n');
}

function sessionOrderLines(sessionContext = {}) {
  const lines = [];
  if (sessionContext.learnerNotes) {
    lines.push(`Learner notes:\n${clip(sessionContext.learnerNotes, 2200)}`);
  }
  if (sessionContext.physicalExamFindings?.length) {
    lines.push('Physical exam findings discovered this session:');
    for (const row of sessionContext.physicalExamFindings) {
      lines.push(`- ${row.label}: ${clip(row.text, 240)}`);
    }
  }
  if (sessionContext.orderResults?.length) {
    lines.push('Orders and results this session:');
    for (const row of sessionContext.orderResults.slice(0, 28)) {
      lines.push(`- [${row.kind || 'order'}] ${row.label}: ${clip(row.text, 200)}`);
    }
  }
  if (sessionContext.stacksPlaced?.length) {
    lines.push(`Stacks placed: ${sessionContext.stacksPlaced.join('; ')}`);
  }
  if (sessionContext.ordersTimeline?.length) {
    lines.push(
      `Order timeline: ${sessionContext.ordersTimeline
        .slice(-16)
        .map((o) => o.label)
        .join(' → ')}`,
    );
  }
  const chat = sessionContext.chatMessages?.length
    ? sessionContext.chatMessages
        .slice(-14)
        .map((m) => `${m.role}: ${clip(m.content, 180)}`)
        .join('\n')
    : '';
  if (chat) lines.push(`Patient chat:\n${chat}`);
  return lines.filter(Boolean).join('\n');
}

function stripDiagnosisSpoilers(text, learningMode = true) {
  if (!learningMode || !text) return text;
  return String(text).replace(DIAGNOSIS_BLOCKLIST, '[finding]');
}

/** Rule-based brief when LLM unavailable. */
export function buildPortraitDirectorBriefFallback(caseContext = {}, { chatMessages = [] } = {}) {
  const learning = caseContext.learningMode !== false;
  const facts = caseContext.patientFacts || {};
  const demo = caseContext.patientDemographics || {};
  const name = caseContext.patientName || facts.name || 'patient';
  const age =
    facts.ageLabel ||
    demo.ageLabel ||
    (facts.age != null ? `${facts.age} ${facts.ageUnit || 'years'}` : 'adult');
  const sex = facts.sex || caseContext.patientSex || 'patient';
  const cc = facts.chiefComplaint || caseContext.chief_complaint || caseContext.title || '';
  const hpi = clip(
    caseContext.clinical_hpi_narrative ||
      caseContext.hpiExcerpt ||
      caseContext.historyText ||
      '',
    320,
  );
  const chat = chatSnippet(chatMessages, 10);
  const discussed = [hpi, chat].filter(Boolean).join('\n');
  const safeDiscussed = stripDiagnosisSpoilers(discussed, learning);

  return {
    patientLabel: `${age} ${sex} (${name})`,
    chiefComplaint: clip(cc, 120),
    visibleFindings: safeDiscussed || 'Appropriate distress for chief complaint; dignified ED presentation.',
    distress: 'Match severity described in presentation — not exaggerated.',
    pose: 'Supine on ED stretcher, hospital gown, monitor cables and pulse ox visible.',
    skinAndExam:
      'Render discussed exam findings in correct anatomic locations only when mentioned (e.g. dry mucosa, rash location, guarding).',
    ivState: 'arrival',
    noDiagnosisLabels: learning,
    noTextInImage: true,
    source: 'fallback',
  };
}

function mergeSessionIntoFallback(fallback, sessionContext, learning) {
  const sessionBlock = sessionOrderLines(sessionContext);
  if (!sessionBlock) return fallback;
  const safe = stripDiagnosisSpoilers(sessionBlock, learning);
  return {
    ...fallback,
    visibleFindings: [fallback.visibleFindings, safe].filter(Boolean).join('\n'),
    sessionUpdate: true,
    source: 'session+fallback',
  };
}

export async function extractPortraitDirectorBrief(
  caseContext = {},
  {
    chatMessages = [],
    portraitBrief = '',
    sessionContext = null,
    sessionUpdate = false,
    callChat = null,
  } = {},
) {
  let fallback = buildPortraitDirectorBriefFallback(caseContext, { chatMessages });
  const learning = caseContext.learningMode !== false;
  const hasSession =
    sessionContext?.hasSessionData
    || sessionOrderLines(sessionContext || '').length > 0;

  if (hasSession) {
    fallback = mergeSessionIntoFallback(fallback, sessionContext, learning);
  }

  const custom = String(portraitBrief || caseContext.portraitBrief || '').trim();
  if (custom) {
    return {
      ...fallback,
      visibleFindings: `${fallback.visibleFindings}\nUser direction: ${clip(custom, 400)}`,
      sessionUpdate: Boolean(sessionUpdate || hasSession),
      source: hasSession ? 'custom+session+fallback' : 'custom+fallback',
    };
  }

  if (typeof callChat !== 'function') return fallback;

  const chat = chatSnippet(chatMessages, 14);
  const sessionBlock = sessionOrderLines(sessionContext || '');
  const isSessionPortrait = Boolean(sessionUpdate || hasSession);

  const system = isSessionPortrait
    ? `You are a clinical photographer updating an ED patient portrait AFTER a learner's workup.
Return JSON only with keys: visibleFindings, distress, pose, skinAndExam, companionsInFrame.
Rules:
- Summarize ALL session notes, physical exam findings, labs, and patient chat into visible appearance cues.
- SAME patient identity, age, sex, ethnicity — same ED bed camera lock as the reference image.
- Pose may change ONLY if findings require it (e.g. lethargic neonate supine, not sitting up; dyspneic patient more upright).
- skinAndExam: map each discovered finding to the correct body region (jaundice → skin/sclera, hepatomegaly → abdomen contour, etc.).
- Use ONLY facts from the session data — no invented results.
${learning ? '- LEARNING MODE: never name a final diagnosis; describe appearance and exam findings only.' : ''}`
    : `You are a clinical photographer and ED physician preparing a patient portrait brief.
Return JSON only with keys: visibleFindings, distress, pose, skinAndExam, companionsInFrame.
Rules:
- Use ONLY facts from case presentation and patient chat — no invented labs or diagnosis names.
${learning ? '- LEARNING MODE: never name a final diagnosis; describe appearance and exam findings only.' : ''}
- skinAndExam: if a rash/lesion/finding is mentioned, state the correct body region.
- pose: ED stretcher, hospital gown, dignified clinical photo.`;

  const user = [
    `Patient: ${fallback.patientLabel}`,
    `Chief complaint: ${fallback.chiefComplaint}`,
    `HPI: ${clip(caseContext.clinical_hpi_narrative || caseContext.hpiExcerpt || '', 500)}`,
    chat ? `Recent patient chat:\n${chat}` : '',
    sessionBlock ? `SESSION SO FAR (notes, exams, orders — integrate into portrait):\n${sessionBlock}` : '',
    isSessionPortrait
      ? 'This is a SESSION UPDATE portrait: keep framing identical to arrival; show discovered findings for a clear before/after teaching image.'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const raw = await callChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { maxTokens: 560, temperature: 0.25 },
    );
    const parsed = JSON.parse(String(raw || '').trim());
    return {
      ...fallback,
      visibleFindings: stripDiagnosisSpoilers(
        parsed.visibleFindings || fallback.visibleFindings,
        learning,
      ),
      distress: parsed.distress || fallback.distress,
      pose: parsed.pose || fallback.pose,
      skinAndExam: parsed.skinAndExam || fallback.skinAndExam,
      companionsInFrame: parsed.companionsInFrame || null,
      sessionUpdate: isSessionPortrait,
      source: isSessionPortrait ? 'llm+session' : 'llm',
    };
  } catch {
    return fallback;
  }
}

export function logPortraitRegenBlock({
  caseId,
  directorBrief,
  prompts = {},
  meta = {},
  timingMs = 0,
}) {
  const bar = '─'.repeat(56);
  console.log(`\n[case-portrait] ${bar}`);
  console.log(`[case-portrait] REGENERATE case ${caseId} (${timingMs}ms)`);
  console.log(`[case-portrait] director source: ${directorBrief?.source || 'unknown'}`);
  console.log(`[case-portrait] patient: ${directorBrief?.patientLabel || '—'}`);
  console.log(`[case-portrait] findings: ${clip(directorBrief?.visibleFindings, 200)}`);
  if (directorBrief?.skinAndExam) {
    console.log(`[case-portrait] skin/exam: ${clip(directorBrief.skinAndExam, 160)}`);
  }
  console.log(`[case-portrait] layers: base=${meta.hasBase ? 'yes' : 'no'} iv=${meta.hasIv ? 'yes' : 'no'} mask=${meta.hasMask ? 'yes' : 'no'}`);
  if (prompts.basePreview) console.log(`[case-portrait] prompt(base): ${clip(prompts.basePreview, 180)}`);
  if (prompts.ivPreview) console.log(`[case-portrait] prompt(iv): ${clip(prompts.ivPreview, 180)}`);
  console.log(`[case-portrait] ${bar}\n`);
}
