#!/usr/bin/env node
/**
 * Post-process CCS QB scrape JSON files in batches of N (default 10).
 *
 * Per file: extract PNGs → scrape-export/<name>/data-linked.json
 *
 * Usage:
 *   node postprocess-batch.js                    # batch 1, size 10
 *   node postprocess-batch.js --batch 2          # second batch of 10
 *   node postprocess-batch.js --all              # all batches
 *   node postprocess-batch.js --batch-size 5 --batch 1
 *   node postprocess-batch.js --dir "C:\Users\steve\MeWorld\step3"
 */

const fs = require('fs');
const path = require('path');
const { extractFromJson } = require('./extract-scrape-images.js');

function parseArgs(argv) {
  const args = {
    batchSize: 10,
    batch: 1,
    all: false,
    dirs: [
      path.join(__dirname, 'scrape-bank', 'raw'),
      path.join(__dirname),
      path.join(process.env.USERPROFILE || '', 'Downloads'),
    ],
    patterns: ['scrape-playwright*.json', 'scrape-output*.json'],
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--batch-size') args.batchSize = Number(argv[++i]);
    else if (a === '--batch') args.batch = Number(argv[++i]);
    else if (a === '--all') args.all = true;
    else if (a === '--dir') args.dirs = [path.resolve(argv[++i])];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node postprocess-batch.js [--batch N] [--batch-size 10] [--all] [--dir PATH]`);
      process.exit(0);
    }
  }
  return args;
}

function globSimple(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const prefix = pattern.replace(/\*.json$/, '');
  const suffix = pattern.includes('*') ? '.json' : '';
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix.replace('*', '')) && f.endsWith('.json'))
    .filter((f) => {
      if (pattern === 'scrape-playwright*.json') return f.startsWith('scrape-playwright');
      if (pattern === 'scrape-output*.json') return f.startsWith('scrape-output');
      return true;
    })
    .map((f) => path.join(dir, f));
}

function collectJsonFiles(dirs, patterns) {
  const seen = new Set();
  const files = [];
  for (const dir of dirs) {
    for (const pat of patterns) {
      for (const f of globSimple(dir, pat)) {
        const key = path.resolve(f).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        files.push(f);
      }
    }
  }
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function summarizeJson(jsonPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const pages = raw.pages || [];
  const clicks = pages.filter((p) => p.step > 0);
  return {
    file: path.basename(jsonPath),
    path: jsonPath,
    scraperVersion: raw.scraperVersion || null,
    mode: raw.mode || null,
    blockIndex: raw.blockIndex ?? null,
    questionsScraped: clicks.length,
    revealsCaptured: clicks.filter((p) => p.revealCaptured || p.hasReveal).length,
    totalPngInJson: clicks.reduce((n, p) => n + (p.imageCount || 0), 0),
    scrapedAt: raw.scrapedAt || null,
  };
}

async function processBatch(files, batchNum, exportRoot) {
  console.log(`\n========== BATCH ${batchNum} (${files.length} files) ==========\n`);
  const manifest = {
    batch: batchNum,
    processedAt: new Date().toISOString(),
    exportRoot,
    files: [],
  };

  for (const jsonPath of files) {
    const summary = summarizeJson(jsonPath);
    console.log(`Processing: ${summary.file}`);
    console.log(`  Q: ${summary.questionsScraped}  reveals: ${summary.revealsCaptured}  png refs: ${summary.totalPngInJson}`);

    try {
      const { outDir, outJsonPath, stats } = await extractFromJson(jsonPath, exportRoot);
      manifest.files.push({
        ...summary,
        status: 'ok',
        imagesExtracted: stats.extracted,
        outDir,
        linkedJson: outJsonPath,
      });
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      manifest.files.push({ ...summary, status: 'error', error: err.message });
    }
  }

  const manifestPath = path.join(exportRoot, `batch-${String(batchNum).padStart(2, '0')}-manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nBatch ${batchNum} manifest: ${manifestPath}`);
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv);
  const allFiles = collectJsonFiles(args.dirs, args.patterns);

  if (!allFiles.length) {
    console.error('No scrape JSON files found in:', args.dirs.join(', '));
    process.exit(1);
  }

  const batches = [];
  for (let i = 0; i < allFiles.length; i += args.batchSize) {
    batches.push(allFiles.slice(i, i + args.batchSize));
  }

  console.log(`Found ${allFiles.length} JSON files → ${batches.length} batch(es) of up to ${args.batchSize}`);
  allFiles.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2, '0')}. ${path.basename(f)}`));

  const exportRoot = path.join(__dirname, 'scrape-export');
  fs.mkdirSync(exportRoot, { recursive: true });

  const toRun = args.all
    ? batches.map((files, i) => ({ batchNum: i + 1, files }))
    : [{ batchNum: args.batch, files: batches[args.batch - 1] }];

  if (!toRun[0]?.files?.length) {
    console.error(`Batch ${args.batch} does not exist (only ${batches.length} batch(es))`);
    process.exit(1);
  }

  for (const { batchNum, files } of toRun) {
    await processBatch(files, batchNum, exportRoot);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
