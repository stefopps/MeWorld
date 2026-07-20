#!/usr/bin/env node
/**
 * Serves scrape-bank as static files + /api/env endpoint.
 * Reads DEEPSEEK_API_KEY from C:\Users\steve\.cursor\master.env.
 * Usage: node server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2]) || 8765;

// ── Load DeepSeek key from global master.env ──────────────────────────────
function readMasterEnv() {
  const masterPath = path.join(os.homedir(), '.cursor', 'master.env');
  if (!fs.existsSync(masterPath)) {
    console.warn('WARN: master.env not found at', masterPath);
    return {};
  }
  const raw = fs.readFileSync(masterPath, 'utf8');
  const env = {};
  let lastKey = null;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { lastKey = null; continue; }
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && val) env[key] = val;
      lastKey = key || null;
    } else if (lastKey) {
      // Continuation line — append to previous key's value
      env[lastKey] += '\n' + trimmed;
    } else {
      lastKey = null;
    }
  }
  // Clean any keys that have embedded newlines (join continuation lines)
  for (const k of Object.keys(env)) {
    if (env[k].includes('\n')) env[k] = env[k].replace(/\n/g, '');
  }
  return env;
}

const MASTER_ENV = readMasterEnv();
console.log('[server] DeepSeek key loaded:', MASTER_ENV.DEEPSEEK_API_KEY ? 'yes (' + MASTER_ENV.DEEPSEEK_API_KEY.slice(0, 12) + '...)' : 'MISSING');
console.log('[server] OpenAI  key loaded:', MASTER_ENV.OPENAI_API_KEY ? 'yes (' + MASTER_ENV.OPENAI_API_KEY.slice(0, 12) + '...)' : 'MISSING');

// ── MIME map ──────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.md':   'text/markdown',
  '.jsonl':'text/plain',
  '.txt':  'text/plain',
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');

    // ── API: env ──────────────────────────────────────────────────────
    if (url.pathname === '/api/env') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        DEEPSEEK_API_KEY: MASTER_ENV.DEEPSEEK_API_KEY || '',
        OPENAI_API_KEY: MASTER_ENV.OPENAI_API_KEY || '',
      }));
      return;
    }

    // ── API: log-deepseek (POST) — append response to JSONL log ──────
    if (url.pathname === '/api/log-deepseek' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const entry = JSON.parse(body);
          entry.serverTs = new Date().toISOString();
          const logPath = path.join(ROOT, 'deepseek-log.jsonl');
          fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── API: deepseek-log (GET) — retrieve logged response ─────────
    if (url.pathname === '/api/deepseek-log') {
      const qid = url.searchParams.get('qid') || '';
      const type = url.searchParams.get('type') || '';
      const logPath = path.join(ROOT, 'deepseek-log.jsonl');
      let found = null;
      if (fs.existsSync(logPath)) {
        const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
        // Walk backwards for latest match
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (String(entry.qid) === String(qid) && entry.type === type) {
              found = entry;
              break;
            }
          } catch (_) {}
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(found));
      return;
    }

    // ── API: save-chat (POST) — backup chat history per node ──────────
    if (url.pathname === '/api/save-chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { nodeId, chatHistory } = JSON.parse(body);
          if (!nodeId || !Array.isArray(chatHistory)) throw new Error('nodeId and chatHistory array required');
          const chatDir = path.join(ROOT, 'user-data', 'chats');
          fs.mkdirSync(chatDir, { recursive: true });
          const chatFile = path.join(chatDir, `node-${nodeId}.json`);
          const entry = { nodeId, updated: new Date().toISOString(), messages: chatHistory };
          fs.writeFileSync(chatFile, JSON.stringify(entry, null, 2), 'utf8');
          console.log('[chat-backup] Saved', chatHistory.length, 'messages for node', nodeId);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── API: load-chat (GET) — load backed-up chat history ──────────
    if (url.pathname === '/api/load-chat') {
      const nodeId = url.searchParams.get('nodeId') || '';
      const chatFile = path.join(ROOT, 'user-data', 'chats', `node-${nodeId}.json`);
      let chat = null;
      if (fs.existsSync(chatFile)) {
        try { chat = JSON.parse(fs.readFileSync(chatFile, 'utf8')); } catch (_) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(chat));
      return;
    }

    // ── API: list-chats (GET) — overview of all chats with activity ──
    if (url.pathname === '/api/list-chats') {
      const chatDir = path.join(ROOT, 'user-data', 'chats');
      const list = [];
      if (fs.existsSync(chatDir)) {
        const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(chatDir, f), 'utf8'));
            list.push({
              nodeId: data.nodeId,
              updated: data.updated,
              messageCount: data.messages?.length || 0,
            });
          } catch (_) {}
        }
      }
      list.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(list));
      return;
    }

    // ── Notes store (MeWorld-style dual-write: disk is canonical) ─────
    const NOTES_FILE = path.join(ROOT, 'user-data', 'notes', 'global-notes.json');
    function readNotesFile() {
      try {
        if (!fs.existsSync(NOTES_FILE)) return { updated: null, notes: [] };
        const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        return { updated: data.updated || null, notes: Array.isArray(data.notes) ? data.notes : [] };
      } catch (_) {
        return { updated: null, notes: [] };
      }
    }
    function writeNotesFile(notes) {
      const dir = path.dirname(NOTES_FILE);
      fs.mkdirSync(dir, { recursive: true });
      const entry = { updated: new Date().toISOString(), notes: Array.isArray(notes) ? notes : [] };
      fs.writeFileSync(NOTES_FILE, JSON.stringify(entry, null, 2), 'utf8');
      return entry;
    }

    // GET /api/notes — full notes list from disk
    if (url.pathname === '/api/notes' && req.method === 'GET') {
      const data = readNotesFile();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
      return;
    }

    // PUT /api/notes — replace full notes list (hydration merge / save)
    if (url.pathname === '/api/notes' && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
          const saved = writeNotesFile(notes);
          console.log('[notes] Saved', notes.length, 'notes to disk');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/notes/append — append one note entry
    if (url.pathname === '/api/notes/append' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const note = JSON.parse(body || '{}');
          if (!note || !String(note.text || '').trim()) throw new Error('note.text required');
          const data = readNotesFile();
          const entry = {
            text: String(note.text).trim(),
            ts: note.ts || new Date().toISOString(),
            qid: note.qid != null ? String(note.qid) : '',
            nodeLabel: note.nodeLabel || '',
            setId: note.setId != null ? note.setId : null,
          };
          data.notes.push(entry);
          const saved = writeNotesFile(data.notes);
          console.log('[notes] Appended note for qid', entry.qid);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── CORS preflight for POST ─────────────────────────────────────
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // ── API: find-node (GET) — locate which set contains a qid ─────────
    if (req.url.startsWith('/api/find-node') && req.method === 'GET') {
      const send = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(obj));
      };
      const qid = url.searchParams.get('qid') || '';
      if (!qid) return send(400, { error: 'qid required' });
      try {
        for (let i = 1; i <= 130; i++) {
          const p = path.join(ROOT, 'graph-data-set-' + i + '.json');
          if (!fs.existsSync(p)) continue;
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if ((d.nodes || []).some(n => String(n.id) === qid)) {
            return send(200, { qid, set: i, coreDiagnosis: d.coreDiagnosis || '' });
          }
        }
        send(404, { qid, error: 'not found in any set' });
      } catch (e) {
        send(500, { error: e.message });
      }
      return;
    }

    // ── API: append-img (POST) — copy image + link to set ──────────────
    if (url.pathname === '/api/append-img' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const send = (code, obj) => {
          res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(obj));
        };
        try {
          const { set, imgName } = JSON.parse(body);
          if (!set || !imgName) return send(400, { ok: false, error: 'set and imgName required' });
          const setNum = parseInt(set, 10);
          if (isNaN(setNum) || setNum < 1) return send(400, { ok: false, error: 'set must be a positive number' });

          // Search for the image file in common locations
          const searchDirs = [
            path.join(os.homedir(), 'Downloads'),
            path.join(os.homedir(), 'Pictures', 'Cursor-Vision-Inbox'),
          ];
          let sourcePath = null;
          const name = String(imgName).replace(/\s+/g, '-');
          // Accept common image extensions
          for (const dir of searchDirs) {
            if (!fs.existsSync(dir)) continue;
            const files = fs.readdirSync(dir);
            for (const f of files) {
              const base = path.parse(f).name.toLowerCase();
              const ext = path.parse(f).ext.toLowerCase();
              if (!['.png','.jpg','.jpeg','.gif','.webp'].includes(ext)) continue;
              if (base === name.toLowerCase() || base.startsWith(name.toLowerCase())) {
                sourcePath = path.join(dir, f);
                break;
              }
            }
            if (sourcePath) break;
          }
          if (!sourcePath) return send(404, { ok: false, error: 'Image not found in Downloads or Cursor-Vision-Inbox. Tried: ' + name });

          // Copy to project images folder
          const imgDir = path.join(ROOT, 'images');
          fs.mkdirSync(imgDir, { recursive: true });
          const ext = path.extname(sourcePath);
          const destName = name + ext;
          const destPath = path.join(imgDir, destName);
          fs.copyFileSync(sourcePath, destPath);

          // Update graph-data-set-N.json
          const jsonPath = path.join(ROOT, 'graph-data-set-' + String(setNum) + '.json');
          if (!fs.existsSync(jsonPath)) {
            // Clean up copied file
            try { fs.unlinkSync(destPath); } catch (_) {}
            return send(404, { ok: false, error: 'graph-data-set-' + setNum + '.json not found' });
          }

          const graphData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          graphData.image = 'images/' + destName;
          fs.writeFileSync(jsonPath, JSON.stringify(graphData, null, 2), 'utf8');

          console.log('[append-img] Linked images/' + destName + ' → Set ' + setNum + ' (source: ' + sourcePath + ')');
          send(200, { ok: true, set: setNum, image: 'images/' + destName, source: sourcePath });
        } catch (e) {
          send(500, { ok: false, error: e.message });
        }
      });
      return;
    }

    // ── API: generate-concept (POST) — 2-stage: DeepSeek visual plan → OpenAI DALL-E ──
    if (url.pathname === '/api/generate-concept' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const send = (code, obj) => {
          res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(obj));
        };
        try {
          const { conceptName, firstPrinciples, question } = JSON.parse(body);
          if (!conceptName) return send(400, { error: 'conceptName required' });

          const dsKey = MASTER_ENV.DEEPSEEK_API_KEY;
          const oaiKey = MASTER_ENV.OPENAI_API_KEY;
          if (!dsKey || !oaiKey) return send(400, { error: 'API keys not available' });

          // ── STAGE 1: DeepSeek reasons → cinematic storyboard ──
          const reasoningSystem = `You are a world-class medical illustrator, pathophysiologist, cinematic concept artist, and scientific storyteller.

Your mission is to convert invisible biological mechanisms into believable physical events.

Every image should feel like a frozen frame from a medical documentary rather than an infographic.

The artwork should teach the disease even if every line of text is removed.

The image is the teacher. The text is only the narration.

## CORE PHILOSOPHY

Never illustrate a diagnosis. Illustrate a mechanism.
Never draw labels first. Draw cause and effect.
Everything visible should answer "What is physically happening?" instead of "What is this called?"

## THE GOLDEN RULE

Every disease is a battle. Every battle has:
• an opponent
• the tissue under attack
• the body's response
• compensation
• failure
• treatment
• restoration

Turn each into a physical object. The viewer should literally watch the battle unfold.

## STORYBOARD STRUCTURE — 9 frames

Instead of a medical poster, create a cinematic storyboard. Each panel is one frame in the story:

Frame 1 — NORMAL STATE: Healthy tissue, everything functioning, peaceful.
Frame 2 — OPPONENT APPEARS: The disease agent arrives — virus landing, cancer forming, clot building, immune attack beginning.
Frame 3 — DAMAGE BEGINS: The opponent physically damages tissue — cells breaking, membranes rupturing, architecture crumbling.
Frame 4 — BODY RESPONDS: The immune system or repair mechanisms activate — cells rushing in, signals firing.
Frame 5 — COMPENSATION: The body adapts — hypertrophy, shunting, buffer systems, alternative pathways.
Frame 6 — FAILURE: Compensation collapses — the mechanism visibly breaks down. Tissue fails.
Frame 7 — TREATMENT ARRIVES: The drug or intervention physically enters the scene — molecules coating targets, surgical tools, antibodies binding.
Frame 8 — OPPONENT DEFEATED: The treatment visibly destroys or neutralizes the disease — osteoclast cracking, clot dissolving, bacteria rupturing.
Frame 9 — RESTORATION: Normal physiology returns. Tissue heals. Architecture rebuilds. Peace restored.

Every frame must visually change. Never repeat the same picture.

## VISUAL LANGUAGE — make mechanisms physical

Instead of "Osteoclast resorption" → show a giant purple osteoclast physically chewing through bone.
Instead of "Drug inhibits osteoclast" → show blue drug molecules coating the osteoclast, it begins cracking, spikes collapse, bone surface becomes quiet.
Instead of "Fibrosis" → show collagen fibers physically weaving a scar like workers repairing a bridge.
Instead of "Immune attack" → show white blood cells climbing into tissue, wrapping around target cells, tissue breaking apart.
Instead of "Inflammation" → show a living wildfire spreading through tissue.

Every biological entity must obey believable physics. Cells should push, pull, climb, bind, fracture, dissolve, weave, compress, stretch, flow, or rebuild in ways that make molecular events feel tangible. Avoid floating symbols or decorative icons. The scene should look like it was photographed inside the body with a macro cinema camera.

## COMPOSITION

16:9 landscape. Large cinematic panels. Minimal text. Black museum-quality background. High contrast. Movie-poster lighting. One mechanism per panel. Large hero renders. Lots of negative space. Each panel reads in under two seconds.

## TEXT RULES — maximum 20-30 words per panel

Text should never dominate. Use only: title, one-line explanation, one takeaway. No paragraphs. No walls of text. The illustration carries the explanation.

## OBJECT DESIGN — give every disease its own visual language

Cancer = growing fractured crystal. Virus = living crystalline drone. Bacteria = armored insect. Autoimmune = friendly-fire soldiers. Amyloid = concrete filling spaces. Plaque = rust spreading through pipes. Fibrosis = construction scaffolding. Clot = concrete plug. Inflammation = living wildfire. Students should recognize the disease from the visual metaphor alone.

## THE INSCRIPTION

Every storyboard should include a cinematic inscription at the top — not a diagnosis, a principle. Example:

PAGET DISEASE OF BONE
Hyperactive osteoclasts drive chaotic remodeling.
Bisphosphonates poison osteoclasts.
Normal bone architecture returns.

The inscription should feel carved into the poster, like the opening line of a documentary.

## OUTPUT FORMAT

Produce exactly this structured storyboard — no introductory text, no closing remarks:

INSCRIPTION: [three-line cinematic principle — disease name on line 1, mechanism on line 2, treatment/resolution on line 3]

FRAME 1 — Normal: [describe what the healthy tissue looks like — peaceful, intact, functioning]
FRAME 2 — Opponent: [describe the disease agent arriving — what does it look like, how does it physically interact with tissue]
FRAME 3 — Damage: [describe the physical destruction — what breaks, what bleeds, what collapses]
FRAME 4 — Response: [describe the body's reaction — what cells arrive, what signals fire, what changes]
FRAME 5 — Compensation: [describe how the body adapts — what grows, what shunts, what buffers]
FRAME 6 — Failure: [describe the moment compensation breaks — tissue visibly failing]
FRAME 7 — Treatment: [describe the intervention arriving — drug molecules, antibodies, surgical repair]
FRAME 8 — Defeat: [describe the opponent being destroyed or neutralized — cracking, dissolving, clearing]
FRAME 9 — Restoration: [describe healing — tissue rebuilding, peace returning, normal function]
PEARL: [one-sentence high-yield clinical takeaway]
COLORS: [cinematic palette — e.g. dark museum background, gold tissue glow, cyan healing, red damage, purple opponent]`;

          const reasoningUser = `Concept: ${conceptName}
${firstPrinciples ? 'First Principles:\n' + firstPrinciples + '\n' : ''}
${question ? 'Question stem:\n' + question.substring(0, 300) : ''}

Produce the cinematic storyboard.`;

          console.log('[generate-concept] Stage 1: DeepSeek reasoning for', conceptName);
          const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + dsKey },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: reasoningSystem },
                { role: 'user', content: reasoningUser },
              ],
              temperature: 0.7, max_tokens: 1000,
            }),
          });
          if (!dsRes.ok) return send(502, { error: 'DeepSeek stage failed: ' + dsRes.status });
          const dsData = await dsRes.json();
          const visualPlan = dsData.choices?.[0]?.message?.content?.trim() || '';
          if (!visualPlan) return send(502, { error: 'DeepSeek returned empty plan' });
          console.log('[generate-concept] Visual plan:', visualPlan.substring(0, 200) + '...');

          // ── STAGE 2: OpenAI DALL-E 3 renders the cinematic storyboard ──
          const stylePrompt = `AAA game concept art. Scientific realism. Pixar-quality storytelling. Unreal Engine 5. Octane Render. Ray tracing. Volumetric lighting. Macro photography. Medical illustration. Photorealistic materials. Cinematic depth of field. 8K. Cross-sectional anatomy. Museum-quality rendering. 16:9 landscape composition. Black museum-quality background. High contrast. Movie-poster lighting. Large cinematic panels with minimal text. Every biological entity must obey believable physics — cells should push, pull, climb, bind, fracture, dissolve, weave, compress, stretch, flow, or rebuild. The scene should look like it was photographed inside the body with a macro cinema camera. No floating symbols. No decorative icons. No clipart. No cartoons. The image is the teacher. The text is only the narration.`;

          const dallePrompt = (stylePrompt + '\n\nVISUAL PLAN TO RENDER:\n' + visualPlan).substring(0, 3900);

          console.log('[generate-concept] Stage 2: DALL-E generation...');
          console.log('[generate-concept] DALL-E prompt length:', dallePrompt.length);
          const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + oaiKey },
            body: JSON.stringify({
              model: 'gpt-image-2',
              prompt: dallePrompt,
              n: 1,
              size: '1024x1024',
              moderation: 'low',
            }),
          });
          if (!oaiRes.ok) {
            const errText = await oaiRes.text();
            console.error('[generate-concept] OpenAI error:', oaiRes.status, errText.substring(0, 300));
            // Fallback: return the visual plan so the user sees something useful
            return send(502, { error: 'DALL-E failed: ' + oaiRes.status, visualPlan });
          }
          const oaiData = await oaiRes.json();
          const imageUrl = oaiData.data?.[0]?.url;
          if (!imageUrl) return send(502, { error: 'DALL-E returned no image URL', visualPlan });

          // ── Download the generated image and cache locally ──
          const imgDir = path.join(ROOT, 'concept-images');
          fs.mkdirSync(imgDir, { recursive: true });
          const slug = conceptName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          const ts = Date.now();
          const localName = slug + '-' + ts + '.png';
          const localPath = path.join(imgDir, localName);

          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) {
            // If we can't cache, return remote URL
            return send(200, { imageUrl, visualPlan, cached: false });
          }
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(localPath, imgBuf);

          const localUrl = '/concept-images/' + localName;
          console.log('[generate-concept] Cached to', localPath, '(' + imgBuf.length + ' bytes)');
          send(200, { ok: true, imageUrl: localUrl, visualPlan, cached: true });
        } catch (e) {
          console.error('[generate-concept] Error:', e);
          send(500, { error: e.message });
        }
      });
      return;
    }

    // ── Static files ──────────────────────────────────────────────────
    let fp = path.join(ROOT, url.pathname);
    // Prevent directory traversal
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

    // If directory, serve index.html
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
      fp = path.join(fp, 'index.html');
    }
    // If the exact path doesn't exist, try adding .html
    if (!fs.existsSync(fp)) fp += '.html';
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not found: ' + url.pathname); return; }

    const ext = path.extname(fp).toLowerCase();
    const ctype = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ctype, 'Access-Control-Allow-Origin': '*' });
    res.end(fs.readFileSync(fp));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('Internal error');
  }
});

server.listen(PORT, () => {
  console.log('[server] Running at http://localhost:' + PORT + '/concept-graphs.html');
  console.log('[server] API key endpoint: http://localhost:' + PORT + '/api/env');
});
