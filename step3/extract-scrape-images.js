#!/usr/bin/env node
/**
 * Extract embedded dataUrl images from scrape JSON into subfolders.
 * Replaces dataUrl with a relative "file" link.
 *
 * Usage:
 *   node extract-scrape-images.js "C:\Users\steve\Downloads\scrape-output (7).json"
 *   node extract-scrape-images.js "C:\Users\steve\Downloads\scrape-output*.json"
 */

const fs = require('fs');
const path = require('path');

function sanitize(s) {
  return String(s || 'unknown')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) return null;

  const mediaType = match[1];
  const isBase64 = !!match[2];
  const payload = match[3];

  let ext = 'bin';
  if (mediaType.includes('svg')) ext = 'svg';
  else if (mediaType.includes('png')) ext = 'png';
  else if (mediaType.includes('jpeg') || mediaType.includes('jpg')) ext = 'jpg';
  else if (mediaType.includes('gif')) ext = 'gif';
  else if (mediaType.includes('webp')) ext = 'webp';
  else {
    const part = mediaType.split('/')[1];
    if (part) ext = part.replace('+xml', 'xml');
  }

  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return { mediaType, ext, buffer };
}

function shouldExtractDataUrl(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return false;
  if (parsed.mediaType.toLowerCase().includes('svg')) return false;
  if (parsed.ext === 'svg') return false;
  // Keep raster medical images only (PNG/JPEG/WebP/GIF), skip UI SVG icons.
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(parsed.ext);
}

function getQuestionFolder(ctx) {
  if (ctx.questionNumber) {
    const num = String(ctx.questionNumber).split('/')[0].trim();
    return `q${String(num).padStart(2, '0')}`;
  }
  if (ctx.step !== undefined) return `step-${String(ctx.step).padStart(2, '0')}`;
  return 'unknown';
}

async function extractFromJson(jsonPath, exportRoot) {
  const baseName = path.basename(jsonPath, path.extname(jsonPath));
  const outDir = path.join(exportRoot, sanitize(baseName));
  const imagesRoot = path.join(outDir, 'images');

  fs.mkdirSync(imagesRoot, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let imageCounter = 0;
  const stats = { extracted: 0, skipped: 0, skippedSvg: 0 };

  async function saveDataUrl(dataUrl, ctx, label) {
    if (!shouldExtractDataUrl(dataUrl)) {
      stats.skippedSvg++;
      stats.skipped++;
      return null;
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      stats.skipped++;
      return { dataUrl };
    }

    const qFolder = getQuestionFolder(ctx);
    const section = ctx.section || 'main';
    const dir = path.join(imagesRoot, qFolder, sanitize(section));
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${sanitize(label)}-${String(imageCounter).padStart(3, '0')}.${parsed.ext}`;
    imageCounter += 1;

    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, parsed.buffer);

    const relFile = path.relative(outDir, fullPath).replace(/\\/g, '/');
    stats.extracted++;

    return {
      file: relFile,
      mediaType: parsed.mediaType,
      sizeBytes: parsed.buffer.length,
    };
  }

  async function walk(node, ctx = {}) {
    if (node == null) return node;

    if (Array.isArray(node)) {
      const results = [];
      for (let i = 0; i < node.length; i++) {
        results.push(await walk(node[i], ctx));
      }
      return results;
    }

    if (typeof node !== 'object') return node;

    const nextCtx = { ...ctx };
    if (node.step !== undefined) nextCtx.step = node.step;
    if (node.questionNumber) nextCtx.questionNumber = node.questionNumber;

    const sectionKeys = [
      'beforeClick',
      'afterClick',
      'reveal',
      'start',
      'snapshots',
    ];
    for (const key of sectionKeys) {
      if (node[key] !== undefined) nextCtx.section = key;
    }

    const out = Array.isArray(node) ? [] : {};

    for (const [key, value] of Object.entries(node)) {
      if (key === 'dataUrl' && typeof value === 'string' && value.startsWith('data:')) {
        const saved = await saveDataUrl(value, nextCtx, key);
        if (saved) Object.assign(out, saved);
        continue;
      }

      if (key === 'images' && Array.isArray(value)) {
        out[key] = [];
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (item?.dataUrl?.startsWith('data:')) {
            const saved = await saveDataUrl(item.dataUrl, nextCtx, `img-${i}`);
            if (saved) {
              out[key].push({
                type: item.type || 'img',
                alt: item.alt ?? null,
                width: item.width ?? null,
                height: item.height ?? null,
                mediaType: item.mediaType || saved.mediaType,
                file: saved.file,
                sizeBytes: saved.sizeBytes,
              });
            }
          } else if (item && !item.dataUrl) {
            out[key].push(item);
          }
        }
        continue;
      }

      if (key === 'pngDataUrls' && Array.isArray(value)) {
        out[key] = [];
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (item?.dataUrl?.startsWith('data:')) {
            const saved = await saveDataUrl(item.dataUrl, nextCtx, `png-${i}`);
            if (saved) {
              out[key].push({
                mediaType: item.mediaType || saved.mediaType,
                alt: item.alt ?? null,
                file: saved.file,
                sizeBytes: saved.sizeBytes,
              });
            }
          } else if (item?.file) {
            out[key].push(item);
          }
        }
        continue;
      }

      if (typeof value === 'object') {
        const childCtx = sectionKeys.includes(key)
          ? { ...nextCtx, section: key }
          : nextCtx;
        out[key] = await walk(value, childCtx);
      } else {
        out[key] = value;
      }
    }

    return out;
  }

  const linked = await walk(raw, { section: 'root' });

  linked._imageExport = {
    sourceJson: path.basename(jsonPath),
    extractedAt: new Date().toISOString(),
    imagesFolder: 'images',
    totalImagesExtracted: stats.extracted,
    totalSkipped: stats.skipped,
    totalSvgSkipped: stats.skippedSvg,
  };

  const outJsonPath = path.join(outDir, 'data-linked.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(linked, null, 2), 'utf8');

  const readme = `# ${baseName}

- Source: ${path.basename(jsonPath)}
- Linked JSON: data-linked.json
- Images: images/qXX/<section>/

Image paths in JSON use relative links in the "file" field (replaces "dataUrl").
`;

  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

  console.log(`\n${baseName}`);
  console.log(`  Images extracted: ${stats.extracted}`);
  if (stats.skippedSvg) console.log(`  SVG icons skipped: ${stats.skippedSvg}`);
  console.log(`  Output folder:    ${outDir}`);
  console.log(`  Linked JSON:      ${outJsonPath}`);

  return { outDir, outJsonPath, stats };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node extract-scrape-images.js <file.json> [more.json ...]');
    process.exit(1);
  }

  const exportRoot = path.join(path.dirname(path.resolve(args[0])), 'scrape-export');
  fs.mkdirSync(exportRoot, { recursive: true });

  console.log(`Export root: ${exportRoot}`);

  for (const arg of args) {
    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved)) {
      console.warn(`Skip (not found): ${resolved}`);
      continue;
    }
    await extractFromJson(resolved, exportRoot);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
