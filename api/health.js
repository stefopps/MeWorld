import { chatProvider, chatModel, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasFal = Boolean(process.env.FAL_KEY);

  sendJson(res, 200, {
    ok: true,
    openai: hasOpenai,
    deepseek: hasDeepseek,
    gemini: hasGemini,
    realWorld: hasDeepseek || hasGemini,
    realWorldProvider: hasDeepseek ? 'deepseek' : hasGemini ? 'gemini' : null,
    realWorldVideoProvider: 'yt-search',
    chatProvider: chatProvider(),
    chatModel: chatModel(),
    fal: hasFal,
    sceneProvider: hasFal ? 'fal' : null,
    casePortraits: hasFal,
    falSceneModel: 'fal-ai/joyai-image-edit',
    chatterbox: false,
    patientVoices: { narrator: 'none', patientMale: 'none', patientFemale: 'none', patientChild: 'none' },
    note: 'Vercel serverless — no Chatterbox. DeepSeek for chat/real-world, FAL for portraits.',
  });
}
