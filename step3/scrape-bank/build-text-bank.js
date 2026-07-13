#!/usr/bin/env node
/**
 * Build a lightweight text-only bank from all raw scrape JSON.
 * Strips images/base64 — keeps only question stem, answers, explanation, likely correct answer.
 * Output: text-bank.jsonl (one JSON per line, grep-friendly) + text-bank.json (compact array).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'raw');
const OUT_JSONL = path.join(ROOT, 'text-bank.jsonl');
const OUT_JSON  = path.join(ROOT, 'text-bank.json');

// ── Load & dedupe ────────────────────────────────────────────────────────────
function loadBank() {
  const byId = new Map();
  const files = fs.readdirSync(RAW).filter(f => /^scrape-playwright/.test(f));
  let totalPages = 0, skipped = 0;

  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); }
    catch { skipped++; continue; }
    const pages = j.pages || j.questions || [];
    totalPages += pages.length;
    for (const p of pages) {
      const rid = String(p.questionId || p.id || '').replace(/\D/g, '');
      if (!rid) continue;
      const stem = (p.question || p.stem || '').trim();
      if (!stem) continue;
      const prev = byId.get(rid);
      const score = (p.hasReveal ? 10 : 0) + (p.explanation || '').length / 100 + (p.answers ? 2 : 0);
      if (!prev || score > prev._score) {
        // Strip images — keep only text
        const cleanStem = stripImages(stem);
        const cleanExplanation = stripImages(p.explanation || '');
        const cleanAnswers = (p.answers || []).map(a => {
          const label = a.label || String.fromCharCode(65 + ((p.answers || []).indexOf(a)));
          const text = stripImages(typeof a === 'string' ? a : (a.text || a.label || ''));
          return { label, text };
        });
        const likely = String(p.likelyCorrectAnswer || p.correctAnswer || '').trim();
        byId.set(rid, {
          id: rid,
          question: cleanStem,
          answers: cleanAnswers,
          explanation: cleanExplanation,
          likely,
          _score: score,
        });
      }
    }
  }
  console.error(`Files: ${files.length - skipped}/${files.length} (${skipped} skipped)`);
  console.error(`Raw pages: ${totalPages}, Unique QIDs: ${byId.size}`);
  return [...byId.values()];
}

function stripImages(text) {
  if (typeof text !== 'string') return '';
  return text
    // Remove HTML img tags
    .replace(/<img[^>]*\/?>/gi, '[IMG]')
    // Remove markdown images
    .replace(/!\[.*?\]\(.*?\)/g, '[IMG]')
    // Remove base64 data URIs
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, '[BASE64_IMG]')
    // Remove file:// or http image references
    .replace(/(?:file:\/\/|https?:\/\/)[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s"'<>]*)?/gi, '[IMG_URL]')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Write ────────────────────────────────────────────────────────────────────
function writeOutputs(questions) {
  // JSONL — one question per line, easy to grep
  let jsonl = '';
  for (const q of questions) {
    const { _score, ...rest } = q;
    jsonl += JSON.stringify(rest) + '\n';
  }
  fs.writeFileSync(OUT_JSONL, jsonl);
  console.error(`Wrote ${OUT_JSONL} (${(Buffer.byteLength(jsonl) / 1024 / 1024).toFixed(1)} MB)`);

  // JSON — compact array for programmatic use
  const compact = questions.map(({ _score, ...rest }) => rest);
  fs.writeFileSync(OUT_JSON, JSON.stringify(compact));
  console.error(`Wrote ${OUT_JSON} (${(fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1)} MB)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const questions = loadBank();
writeOutputs(questions);

// Summary
const withExplanation = questions.filter(q => q.explanation.length > 0).length;
const withAnswers = questions.filter(q => q.answers.length > 0).length;
const withLikely = questions.filter(q => q.likely.length > 0).length;
const avgStemLen = Math.round(questions.reduce((s, q) => s + q.question.length, 0) / questions.length);
const avgExplLen = Math.round(questions.reduce((s, q) => s + q.explanation.length, 0) / Math.max(1, withExplanation));

console.error('');
console.error(`With answers: ${withAnswers}/${questions.length}`);
console.error(`With explanation: ${withExplanation}/${questions.length}`);
console.error(`With likely answer: ${withLikely}/${questions.length}`);
console.error(`Avg stem length: ${avgStemLen} chars`);
console.error(`Avg explanation length: ${avgExplLen} chars`);
console.error('');
console.error('Done. Cursor can now:');
console.error('  rg "diabetic ketoacidosis" text-bank.jsonl');
console.error('  or reference text-bank.json for structured lookups');
