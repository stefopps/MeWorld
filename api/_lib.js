/**
 * Shared utilities for Vercel serverless API functions.
 * Calls the DeepSeek API directly using Vercel environment variables.
 * Underscore prefix keeps Vercel from routing this file as an endpoint.
 */

const DEEPSEEK_API_KEY = () => process.env.DEEPSEEK_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export function chatProvider() {
  if (DEEPSEEK_API_KEY()) return 'deepseek';
  if (OPENAI_API_KEY) return 'openai';
  return null;
}

export function chatModel() {
  if (chatProvider() === 'deepseek') return DEEPSEEK_CHAT_MODEL;
  return OPENAI_CHAT_MODEL;
}

export function requireApiKey(res) {
  const key = DEEPSEEK_API_KEY() || OPENAI_API_KEY;
  if (!key) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Set DEEPSEEK_API_KEY in Vercel env vars' }));
    return null;
  }
  return key;
}

export async function callChatCompletion(messages, { maxTokens = 700, temperature = 0.35 } = {}) {
  const key = DEEPSEEK_API_KEY() || OPENAI_API_KEY;
  if (!key) throw new Error('No API key configured');

  const provider = chatProvider();
  const model = chatModel();
  const endpoint =
    provider === 'deepseek'
      ? 'https://api.deepseek.com/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => `HTTP ${r.status}`);
    throw new Error(err || `${provider} error ${r.status}`);
  }

  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response.';
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Read JSON body from an IncomingMessage (no Express middleware) */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const ORDER_WHY_SYSTEM = `You are a brilliant senior attending who teaches by mechanism — not by memorization — during a USMLE CCS case.

Write 3–5 short sentences for a medical student actively placing orders. Reveal WHY this order belongs in THIS patient's workup: the underlying physiology, spatial pattern, or pathophysiology that makes it inevitable. The learner should feel "Of course — how could it be any other way?"

Rules:
- Lead with mechanism. Never start with "This order is important because..." Start with what is physically happening in this patient.
- Be specific to THIS presentation (chief complaint, HPI, vitals from context) — not generic textbook filler.
- Mention what finding you expect, what you rule in/out, or what changes your next step.
- Use visual/spatial language when a sign has distribution, timing, or location.
- If playbookHint is provided, deepen it mechanistically — do not repeat it verbatim.
- Always wrap salient mechanistic anchors in **double asterisks**: core pathophysiology, expected finding, rule-out, spatial pattern, or bedside decision (2–4 bold phrases per reply). Prose only — no bullet lists or headers besides **bold** inline.
- Direct tone. Short sentences. No hedging. No passive voice. No "as an AI".`;

const ORDER_WHY_ALTERNATE_SYSTEM = `You are giving a SECOND OPINION on the same order during a USMLE CCS case. The student already heard one explanation — teach a genuinely different mechanistic angle. Do NOT repeat or lightly rephrase previousExplanation.

Voice fusion (stay clinical — no tech IPO talk, no politics):
- **Alex Karp:** philosopher-contrarian intensity. Conviction over consensus. Non-linear insight leaps. Moral clarity about what this decision *means* at the bedside. Willing to sound blunt if the biology demands it.
- **Elon Musk:** first-principles physics. Strip the workup to what must be true in this patient's body. Declarative, bottleneck-focused sentences applied to pathophysiology.
- **Dr. Anthony Fauci:** public-health physician clarity — what this order changes for THIS patient, what you rule in/out, what's at stake for outcome or transmission when relevant. Evidence-grounded, patient-centered.

Rules:
- 3–5 short sentences. Different lens than the first attending — new pathophysiology link, expected finding, rule-out, or spatial/temporal frame tied to THIS patient.
- Be specific to chief complaint, HPI, vitals from context — not generic textbook filler.
- Mention what finding you expect, what you rule in/out, or what changes your next step.
- Always wrap salient mechanistic anchors in **double asterisks** (2–4 bold phrases per reply). Prose only — no bullet lists or headers besides **bold** inline.
- Direct tone. Short sentences. No hedging. No "as an AI". No bullet lists.`;

export function buildOrderWhyPrompt({
  orderLabel,
  playbookWhy = '',
  caseContext = {},
  alternate = false,
  previousWhy = '',
}) {
  const cc =
    caseContext.chief_complaint ||
    caseContext.title ||
    caseContext.patientFacts?.chiefComplaint ||
    '';
  const diagnosis =
    caseContext.diagnosis ||
    caseContext.objective ||
    caseContext.clinical_tip ||
    '';
  const hpi =
    caseContext.hpiExcerpt ||
    caseContext.clinical_hpi_narrative ||
    caseContext.historyText ||
    '';
  const vitals = caseContext.vitalsText || '';

  const user = {
    order: orderLabel,
    chiefComplaint: cc,
    caseTitle: caseContext.title || null,
    category: caseContext.category || null,
    diagnosisOrPearl: diagnosis ? String(diagnosis).slice(0, 600) : null,
    hpiExcerpt: hpi ? String(hpi).slice(0, 900) : null,
    vitals: vitals ? String(vitals).slice(0, 400) : null,
    playbookHint: playbookWhy ? String(playbookWhy).slice(0, 400) : null,
  };

  if (alternate) {
    user.previousExplanation = String(previousWhy || '').trim().slice(0, 900) || null;
  }

  const system = alternate ? ORDER_WHY_ALTERNATE_SYSTEM : ORDER_WHY_SYSTEM;
  const userPrompt = alternate
    ? `Give a second-opinion teaching explanation for this order. Use a different angle than the previous one:\n${JSON.stringify(user, null, 2)}`
    : `Explain why this order is relevant for this case:\n${JSON.stringify(user, null, 2)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ];
}
