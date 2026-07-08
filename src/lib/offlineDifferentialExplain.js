function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeDx(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function paragraphForDiagnosis(summary, diagnosis) {
  const paragraphs = String(summary || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const target = normalizeDx(diagnosis);
  if (!target) return '';

  const ranked = paragraphs
    .map((p, idx) => {
      const lower = p.toLowerCase();
      let score = 0;
      if (lower.includes(target)) score += 3;
      if (/^the patient (has|had|is|was)/i.test(p)) score += 2;
      if (/^differential:/i.test(p)) score += 1;
      const words = target.split(' ').filter((w) => w.length > 3);
      score += words.filter((w) => lower.includes(w)).length;
      return { p, idx, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.p || '';
}

function differentialList(summary) {
  const match = String(summary || '').match(/differential:\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (!match) return [];
  return match[1]
    .split(/[,;\n]/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((s) => s.length > 2 && !/^and$/i.test(s));
}

/**
 * Build a structured explainer from local CCS review text — no API required.
 */
export function buildOfflineDifferentialExplain({
  diagnosis,
  topic = '',
  caseDiagnosis = '',
  ccsReview = null,
} = {}) {
  const dx = String(diagnosis || '').trim();
  if (!dx) return null;

  const summary = String(ccsReview?.caseSummary || ccsReview?.reviewText || '').trim();
  const paragraph = paragraphForDiagnosis(summary, dx);
  const sentences = splitSentences(paragraph);
  const dxList = differentialList(summary);
  const isCaseDx =
    caseDiagnosis && normalizeDx(caseDiagnosis) === normalizeDx(dx);

  let hook = sentences[0] || '';
  if (!hook) {
    hook = isCaseDx
      ? `This case's diagnosis is ${dx} — anchor the mechanism to the presenting complaint${topic ? `: ${topic}` : ''}.`
      : `${dx} belongs on the differential${topic ? ` for ${topic}` : ''} — ask what pathophysiology would force this diagnosis to the top.`;
  }

  const features = sentences.slice(1, 4);
  while (features.length < 3) {
    if (features.length === 0 && dxList.length) {
      features.push(`Keep ${dx} in the differential alongside: ${dxList.slice(0, 4).join(', ')}.`);
    } else if (features.length === 1 && topic) {
      features.push(`Chief complaint "${topic}" — which finding would increase or decrease suspicion for ${dx}?`);
    } else if (features.length === 2 && caseDiagnosis && !isCaseDx) {
      features.push(`Contrast with ${caseDiagnosis}: different mechanism, timing, or exam pattern.`);
    } else {
      features.push(`Review classic features, triggers, and red flags for ${dx}.`);
    }
  }

  const traps = [];
  if (caseDiagnosis && !isCaseDx) {
    traps.push(
      `Often confused with ${caseDiagnosis} — compare the underlying mechanism, not just overlapping symptoms.`,
    );
  }
  const neighbors = dxList.filter((d) => normalizeDx(d) !== normalizeDx(dx)).slice(0, 2);
  neighbors.forEach((n) => {
    traps.push(`${dx} vs ${n} — what single clue breaks the tie?`);
  });
  if (!traps.length) {
    traps.push(`Do not anchor on one finding — ${dx} requires pattern recognition across HPI, exam, and context.`);
  }

  const clue =
    isCaseDx && topic
      ? `Presentation: ${topic} — the case diagnosis ${dx} should stay at the top once key data points align.`
      : topic
        ? `Chief complaint "${topic}" is your anchor — which HPI or exam clue would activate ${dx} on your list?`
        : `What is the one discriminating history or exam finding that should trigger ${dx}?`;

  return {
    hook,
    features: features.slice(0, 3),
    traps: traps.slice(0, 2),
    clue,
    source: paragraph ? 'ccs-review' : 'template',
    body: paragraph || null,
  };
}
