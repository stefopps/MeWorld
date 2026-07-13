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
