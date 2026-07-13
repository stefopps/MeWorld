#!/usr/bin/env node
/**
 * Avatar Surgery for Batch 11-20.
 *
 * Audit result:
 *   Nadia (SLE/lupus + Dr. Iwu) plausible for: Sets 12,13,14,15,18,19,20
 *   NEEDS NEW AVATAR:
 *     Set 11 (Diabetes)        → Marcus Chen   + Dr. Elena Reyes
 *     Set 16 (GI Bleed)        → Elena Vasquez  + Dr. Chidi Okafor
 *     Set 17 (Arrhythmias)     → Robert Kim     + Dr. Priya Patel
 *
 * Surgery: in-place string replacement in story HTML + graph-data JSON.
 *
 * Run: node avatar-surgery-11-20.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const AVATARS = {
  11: {
    patient: 'Marcus Chen',
    doctor: 'Dr. Elena Reyes',
    patientDesc: '58M, Type 2 diabetes × 20 years, neuropathy / nephropathy / retinopathy',
    doctorDesc: 'endocrinology',
    core: 'Diabetes cascade — DKA/HHS → complications → infections',
  },
  16: {
    patient: 'Elena Vasquez',
    doctor: 'Dr. Chidi Okafor',
    patientDesc: '52F, alcoholic cirrhosis, portal hypertension, thrombocytopenia',
    doctorDesc: 'GI / hepatology',
    core: 'GI bleed — variceal → diverticular → IBD differential',
  },
  17: {
    patient: 'Robert Kim',
    doctor: 'Dr. Priya Patel',
    patientDesc: '68M, CAD, paroxysmal AFib, CHF',
    doctorDesc: 'cardiology',
    core: 'Arrhythmia cascade — AFib → SVT → VTach → heart block',
  },
};

// ── Surgery functions ────────────────────────────────────────────────────────
function replaceAvatarInText(text, avatar) {
  // Only replace whole-word "Nadia" and "Dr. Iwu" in prose, not in code keys
  let t = text;
  t = t.replace(/\bNadia\b/g, avatar.patient);
  t = t.replace(/\bDr\. Iwu\b/g, avatar.doctor);
  return t;
}

function replaceAvatarInStorySteps(raw, avatar) {
  // STORY_STEPS is a JSON block. Replace only inside "text" values.
  // Simpler: just replace whole-string Nadia and Dr. Iwu globally in the block.
  return replaceAvatarInText(raw, avatar);
}

function surgeryStoryHtml(setNum, avatar) {
  const setPad = String(setNum).padStart(2, '0');
  // Find the file — Pattern A = va, Pattern B = vb. Sets 11-15 = A, 16-20 = B.
  const suffix = setNum <= 15 ? 'va' : 'vb';
  const file = `set-${setPad}-story-${suffix}.html`;
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) {
    console.error(`  Missing: ${file}`);
    return;
  }
  let html = fs.readFileSync(fp, 'utf8');

  // 1. Replace in header paragraph
  html = html.replace(
    /Avatar demo · Nadia &amp; Dr\. Iwu \(placeholder\)/g,
    `Avatar demo · ${avatar.patient} &amp; ${avatar.doctor} (placeholder)`
  );

  // 2. Replace in STORY_STEPS block
  const storyStart = html.indexOf('const STORY_STEPS = ');
  const storyEnd = html.indexOf('\nlet si = 0', storyStart);
  if (storyStart >= 0 && storyEnd > storyStart) {
    const before = html.slice(0, storyStart);
    const rawSteps = html.slice(storyStart, storyEnd);
    const after = html.slice(storyEnd);
    const replaced = replaceAvatarInStorySteps(rawSteps, avatar);
    html = before + replaced + after;
  }

  // 3. Also replace any loose Nadia/Dr. Iwu in the header
  html = html.replace(/\bNadia(?![^<]*>)/g, (match, offset) => {
    // Only replace if we're not inside an HTML tag
    const context = html.slice(Math.max(0, offset - 50), offset + 50);
    if (context.includes('<')) return match;
    return avatar.patient;
  });

  fs.writeFileSync(fp, html);
  console.log(`  Story: ${file} → ${avatar.patient}`);
}

function surgeryGraphJson(setNum, avatar) {
  const setPad = String(setNum).padStart(2, '0');
  const file = `graph-data-set-${setPad}.json`;
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) {
    console.error(`  Missing: ${file}`);
    return;
  }
  let json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  json.coreDiagnosis = avatar.patientDesc;
  json.recurringThread = avatar.core;
  fs.writeFileSync(fp, JSON.stringify(json, null, 2));
  console.log(`  Graph:  ${file} → ${avatar.core}`);
}

function surgeryConceptHtml(setNum, avatar) {
  const setPad = String(setNum).padStart(2, '0');
  const file = `set-${setPad}-concept-graph.html`;
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) {
    console.error(`  Missing: ${file}`);
    return;
  }
  let html = fs.readFileSync(fp, 'utf8');
  html = html.replace(
    /<strong>Core:[\s\S]*?<\/strong>/,
    `<strong>Patient: ${avatar.patient} (${avatar.patientDesc}) · Doctor: ${avatar.doctor} (${avatar.doctorDesc})</strong>`
  );
  fs.writeFileSync(fp, html);
  console.log(`  Viewer: ${file} → ${avatar.patient}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('=== Avatar Surgery — Batch 11-20 ===\n');

for (const [setStr, avatar] of Object.entries(AVATARS)) {
  const sn = Number(setStr);
  console.log(`Set ${sn}: ${avatar.patient} (${avatar.patientDesc}) + ${avatar.doctor} (${avatar.doctorDesc})`);
  surgeryStoryHtml(sn, avatar);
  surgeryGraphJson(sn, avatar);
  surgeryConceptHtml(sn, avatar);
  console.log('');
}

// Update manifests
console.log('Updating sets-11-20-manifest.json...');
const manifestPath = path.join(ROOT, 'sets-11-20-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const entry of manifest) {
  const a = AVATARS[entry.set];
  if (a) {
    entry.avatar = {
      patient: a.patient,
      doctor: a.doctor,
      patientDesc: a.patientDesc,
      doctorDesc: a.doctorDesc,
    };
  } else {
    entry.avatar = {
      patient: 'Nadia',
      doctor: 'Dr. Iwu',
      patientDesc: 'Lupus / SLE patient — original avatar',
      doctorDesc: 'rheumatology',
    };
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Also update sets-11-20-manifest.md
let md = fs.readFileSync(path.join(ROOT, 'sets-11-20-manifest.md'), 'utf8');
md = md.replace(/Status:.*\n/, 'Status: DRAFT for Master review. 3 avatars in this batch (Nadia + 3 new).\n');
fs.writeFileSync(path.join(ROOT, 'sets-11-20-manifest.md'), md);

console.log('Done. 3 sets received new avatars, 7 stayed with Nadia.');
