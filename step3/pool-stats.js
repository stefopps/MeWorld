/**
 * Track CCS Create Test pool counters (Unused, Marked, Correct, Omitted, Incorrect).
 */

const fs = require('fs');
const path = require('path');

const POOL_STATS_LOG = path.join(__dirname, 'pool-stats-log.jsonl');

async function readPoolStatsFromPage(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const pick = (label) => {
      const re = new RegExp(`\\b${label}\\b[^\\d]{0,40}(\\d[\\d,]*)`, 'i');
      const m = text.match(re);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
    };
    const stats = {
      unused: pick('Unused'),
      marked: pick('Marked'),
      correct: pick('Correct'),
      omitted: pick('Omitted'),
      incorrect: pick('Incorrect'),
    };
    const nums = Object.values(stats).filter((n) => n != null);
    stats.totalAccounted =
      nums.length === 5 ? stats.unused + stats.marked + stats.correct + stats.omitted + stats.incorrect : null;
    return stats;
  });
}

function appendPoolStats(entry) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  fs.appendFileSync(POOL_STATS_LOG, line + '\n');
  console.log(
    `  [pool] Unused=${entry.unused ?? '?'} Marked=${entry.marked ?? '?'} Correct=${entry.correct ?? '?'} Omitted=${entry.omitted ?? '?'} Incorrect=${entry.incorrect ?? '?'}`
  );
  if (entry.deltaUnused != null) {
    console.log(`  [pool] ΔUnused=${entry.deltaUnused > 0 ? '+' : ''}${entry.deltaUnused} since last check`);
  }
  return entry;
}

function lastPoolStats() {
  if (!fs.existsSync(POOL_STATS_LOG)) return null;
  const lines = fs.readFileSync(POOL_STATS_LOG, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

async function captureAndLogPoolStats(page, meta = {}) {
  const stats = await readPoolStatsFromPage(page);
  const prev = lastPoolStats();
  const entry = {
    ...stats,
    ...meta,
    deltaUnused: prev?.unused != null && stats.unused != null ? stats.unused - prev.unused : null,
  };
  return appendPoolStats(entry);
}

module.exports = {
  POOL_STATS_LOG,
  readPoolStatsFromPage,
  captureAndLogPoolStats,
  appendPoolStats,
  lastPoolStats,
};
