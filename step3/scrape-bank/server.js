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
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val) env[key] = val;
  }
  return env;
}

const MASTER_ENV = readMasterEnv();
console.log('[server] DeepSeek key loaded:', MASTER_ENV.DEEPSEEK_API_KEY ? 'yes (' + MASTER_ENV.DEEPSEEK_API_KEY.slice(0, 12) + '...)' : 'MISSING');

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

    // ── CORS preflight for POST ─────────────────────────────────────
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
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
