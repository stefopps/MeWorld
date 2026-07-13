#!/usr/bin/env node
/**
 * Full Bank Spine-Cluster Scan (~4,852 questions).
 *
 * Phase 1 (this script):
 *   - Extract (age, sex, condition) from every question
 *   - Type 1: exact patient-repeat clustering
 *   - Type 2: mark remaining questions for LLM organic-connection review
 *   - Cross-reference against existing set assignments
 *
 * Phase 2 (agent review):
 *   - Propose organic encounters for Type 2 questions
 *   - Apply travel-fit reasoning
 *   - Output spine-cluster-candidates.md
 *
 * Run: node scan-full-bank-spines.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BANK = require(path.join(ROOT, 'text-bank.json'));
const OUT_JSON = path.join(ROOT, 'spine-cluster-data.json');
const OUT_MD  = path.join(ROOT, 'spine-cluster-candidates.md');

// ── 1. Demographic extraction ─────────────────────────────────────────────────

function extractAge(stem) {
  const patterns = [
    /(\d+)[ -]year[ -]old/,
    /(\d+)[ -]month[ -]old/,
    /(\d+)[ -]week[ -]old/,
    /aged (\d+)/,
    /at (\d+) years/,
    /(\d+) years old/,
    /(\d+)-year-old/,
  ];
  for (const re of patterns) {
    const m = stem.match(re);
    if (m) return parseInt(m[1], 10);
  }
  // Newborn / neonate
  if (/\b(neonate|newborn|[12] day old|3 day old)\b/i.test(stem)) return 0;
  return null;
}

function extractSex(stem) {
  const first100 = stem.slice(0, 100).toLowerCase();
  if (/\b(man|male|boy|gentleman|mister|mr\.? |his )/.test(first100)) return 'M';
  if (/\b(woman|female|girl|lady|ms\.? |mrs\.? |her )/.test(first100)) return 'F';
  return null;
}

function isProcedure(text) {
  const t = text.toLowerCase();
  return /\b(perform|order|obtain|initiate|start|administer|prescribe|recommend|advise|counsel|measure|check|test|biopsy|surgery|excision|resection|repair|replace|transplant|refer|consult|screen|monitor)\b/i.test(t)
    || /\b(ct scan|mri|ultrasound|x.?ray|colonoscopy|endoscopy|bronchoscopy|angiography|catheter|ecg|ekg|echo|pulmonary function|spirometry|cpap|ventilation|dialysis|transfusion|vaccin|immunoglobul)\b/i.test(t)
    || /\b(analgesi|narcotic|antibiotic|steroid|diuretic|beta.?block|ace.?inhibitor|statin|insulin|chemo|radiation)\b/i.test(t);
}

function isDisease(text) {
  const t = text.toLowerCase();
  return /\b(disease|syndrome|disorder|failure|itis|osis|emia|oma|pathy|cancer|carcinoma|deficiency|insufficiency|stenosis|cirrhosis|nephritis|hepatitis|pneumonia|thrombosis|infarction|hemorrhage|abscess|fracture|injury|infection|sepsis)\b/i.test(t)
    || /\b(coronary artery|myocardial|heart fail|pulmonary embol|diabetes|hypertens|asthma|copd|sickle|thalassem|cushing|addison|hyperthyroid|hypothyroid|graves|lupus|scleroderma|rheumatoid)\b/i.test(t);
}

function extractCondition(q) {
  let condition = '';

  // Strategy 1: Look up the full answer text for the `likely` letter
  let likelyText = '';
  if (q.likely && q.answers && q.answers.length > 0) {
    const letter = String(q.likely).replace(/[^A-Z]/g, '').trim();
    const match = q.answers.find(a => String(a.label).trim() === letter);
    if (match && match.text) {
      likelyText = match.text.replace(/\s*\(?\d+[.,]?\d*%\)?\s*$/, '').trim();
    }
  }

  // Use likely answer IF it names a disease, not if it's a procedure
  if (likelyText && isDisease(likelyText) && !isProcedure(likelyText)) {
    condition = likelyText;
  }

  // Strategy 2: Mine the stem for the diagnosis
  if (!condition || condition.length < 3) {
    const stem = q.question || '';
    const firstSent = stem.split(/[.?!]\s/)[0] || '';

    // Pattern: "A X-year-old Y with Z"
    const withMatch = firstSent.match(/A \d+[-\s]year[-\s]old \w+ (?:with|diagnosed with|who has|presenting with|admitted for|being treated for|known to have|history of)\s+([^,.;]+?(?:disease|syndrome|disorder|failure|itis|osis|emia|oma|pathy|deficiency|insufficiency|stenosis|cirrhosis|nephritis|hepatitis|pneumonia|thrombosis|infarction|hemorrhage|bleed|mass|tumor|cancer|carcinoma))/i);
    if (withMatch) {
      condition = withMatch[1].trim();
    }

    // Pattern: "A X-year-old Y presents with Z"
    if (!condition || condition.length < 3) {
      const presentMatch = firstSent.match(/presents (?:to|with|due to)\s+([^,.;]+?(?:disease|syndrome|disorder|failure|itis|osis|emia|oma|pathy|deficiency|insufficiency|stenosis|cirrhosis|nephritis|hepatitis|pneumonia|thrombosis|infarction|hemorrhage|bleed|mass|tumor|cancer))/i);
      if (presentMatch) condition = presentMatch[1].trim();
    }

    // Pattern: simple "history of Z"
    if (!condition || condition.length < 3) {
      const histMatch = firstSent.match(/(?:history of|diagnosed with)\s+([^,.;]+?(?:disease|syndrome|disorder|failure|itis|osis|emia|oma|pathy))/i);
      if (histMatch) condition = histMatch[1].trim();
    }

    // If we still don't have a disease, use the first named condition from the stem
    if (!condition || condition.length < 3) {
      const namedMatch = firstSent.match(/\b([A-Z][a-z]+ (?:disease|syndrome|disorder|failure))\b/);
      if (namedMatch) condition = namedMatch[1].trim();
    }
  }

  // Strategy 3: Use likely answer even if it's a procedure, as last resort
  if (!condition || condition.length < 3) {
    condition = likelyText;
  }

  // Final fallback
  if (!condition || condition.length < 2) {
    const stem = (q.question || '').replace(/\s+/g, ' ').trim();
    condition = stem.slice(0, 80);
  }

  return condition.replace(/[\[\]]/g, '').trim().slice(0, 120);
}

function extractSummary(q) {
  // Get the key demographic info from the stem
  const stem = q.question.replace(/\s+/g, ' ').trim();
  // Extract "A X-year-old Y" pattern
  const quickMatch = stem.match(/A (\d+)[-\s]year[-\s]old (\w+(?:\s+\w+){0,3})/i);
  if (quickMatch) return quickMatch[0];
  return stem.slice(0, 120);
}

// ── 2. Load existing set assignments ──────────────────────────────────────────

function loadSetAssignments() {
  const used = new Map(); // QID → { set, sceneId, sceneTitle, indexInScene }
  const files = fs.readdirSync(ROOT).filter(f => /^set-\d+-story-v[ab]\.html$/.test(f));
  for (const f of files) {
    const setMatch = f.match(/set-(\d+)/);
    if (!setMatch) continue;
    const sn = parseInt(setMatch[1], 10);
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
    const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
    if (end < start) continue;
    try {
      const items = JSON.parse(html.slice(start, end + 1));
      for (const item of items) {
        used.set(String(item.id), {
          set: sn,
          sceneId: item.sceneId,
          sceneTitle: item.sceneTitle || '',
          indexInScene: item.indexInScene,
        });
      }
    } catch (e) {
      console.error('Parse error in', f, e.message);
    }
  }
  return used;
}

// ── 3. Type 1 clustering ──────────────────────────────────────────────────────

function normalizeCondition(cond) {
  return cond.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function clusterType1(signatures, used) {
  const groups = new Map();

  for (const sig of signatures) {
    if (sig.age === null || sig.sex === null) continue;
    const norm = normalizeCondition(sig.condition);
    if (norm.length < 4) continue;

    // Group by sex + first 2 words of normalized condition (broader bucket)
    const shortCond = norm.split(' ').slice(0, 3).join(' ');
    const key = `${sig.sex}|${shortCond}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.set(key, [...groups.get(key), sig]);
  }

  // Filter: require at least 2 within ±5 age range AND condition similar
  const clusters = [];
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const sorted = members.sort((a, b) => a.age - b.age);
    const subClusters = [];
    let current = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      // Within ±5 years AND condition strings are similar
      const ageClose = Math.abs(sorted[i].age - current[0].age) <= 5;
      const condA = normalizeCondition(current[0].condition).slice(0, 40);
      const condB = normalizeCondition(sorted[i].condition).slice(0, 40);
      const condClose = condA === condB || levenshteinSimilarity(condA, condB) > 0.5;

      if (ageClose && condClose) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) subClusters.push(current);
        current = [sorted[i]];
      }
    }
    if (current.length >= 2) subClusters.push(current);

    for (const sub of subClusters) {
      const hasProgression = sub.length >= 2 && Math.abs(sub[0].age - sub[sub.length - 1].age) >= 2;
      const assignedSets = new Set();
      for (const s of sub) {
        const a = used.get(s.id);
        if (a) assignedSets.add(String(a.set));
      }
      const allAges = [...new Set(sub.map(s => s.age))].sort((a, b) => a - b);
      const ageRange = allAges.length > 1 ? `${allAges[0]}-${allAges[allAges.length - 1]}` : String(allAges[0]);

      clusters.push({
        signature: `${sub[0].sex}·age ${ageRange}·${sub[0].condition}`,
        size: sub.length,
        ages: allAges,
        sex: sub[0].sex,
        condition: sub[0].condition,
        progression: hasProgression,
        assignedToSets: [...assignedSets].map(Number).sort((a, b) => a - b),
        questions: sub.map(s => {
          const a = used.get(s.id);
          return {
            id: s.id,
            summary: s.summary,
            condition: s.condition,
            age: s.age,
            sex: s.sex,
            assigned: a ? `Set ${a.set}·Scene ${a.sceneId}·#${a.indexInScene}` : 'unassigned',
            question: s.question.replace(/\s+/g, ' ').trim().slice(0, 300),
          };
        }),
      });
    }
  }

  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => [i]);
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - d[n][m] / Math.max(n, m);
}

// ── 4. Type 2 extraction — questions NOT in Type 1 ────────────────────────────

function extractType2Candidates(signatures, type1Ids, used) {
  const unassignedIds = new Set();
  for (const sig of signatures) {
    if (!type1Ids.has(sig.id)) unassignedIds.add(sig.id);
  }

  // Group by broad category (from condition text) for easier semantic review
  const byCategory = {};
  for (const sig of signatures) {
    if (!unassignedIds.has(sig.id)) continue;
    const cat = categorizeCondition(sig.condition);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(sig);
  }

  return { count: unassignedIds.size, byCategory };
}

function categorizeCondition(cond) {
  const c = cond.toLowerCase();
  if (/cardi|heart|coronary|arrhyth|atrial fib|ventricul|myocard|infarction|valve|hypertension|\bbp\b|systolic|diastolic/.test(c)) return 'cardiovascular';
  if (/infect|sepsis|pneumonia|meningitis|abscess|fever|bacterial|viral|fungal|parasit|tb\b|hiv|aids/.test(c)) return 'infectious';
  if (/renal|kidney|neph|dialysis|urinary|bladder|prostate/.test(c)) return 'renal';
  if (/gastro|colon|bowel|stomach|esophageal|peptic|ulcer|gi bleed|diarrhea|constipat|hepatitis|cirrhosis|pancreas|gallbladder|biliary/.test(c)) return 'gastrointestinal';
  if (/respir|lung|pneum|asthma|copd|pulmonary|pleur|dyspnea|cough|tb\b/.test(c)) return 'respiratory';
  if (/neuro|stroke|cva\b|seizure|migraine|headache|dementia|alzheimer|parkinson|multiple sclero|als\b|myasthenia|guillain/.test(c)) return 'neurology';
  if (/endo|thyroid|diabetes|gluc|insul|dka\b|hormon|pituitary|adrenal|cushing|addison|hyperparathy|osteoporo/.test(c)) return 'endocrine';
  if (/heme|anemia|bleed|coag|thrombo|platelet|hemoglobin|leukemia|lymphoma|myeloma|sickle/.test(c)) return 'hematology';
  if (/rheum|arthritis|autoimmun|lupus|sclero|sjogren|vasculitis|gout|giant cell/.test(c)) return 'rheumatology';
  if (/cancer|carcinoma|tumor|malign|metastas|neoplasm|sarcoma|chemotherapy|radiation/.test(c)) return 'oncology';
  if (/psych|depress|anxiety|schizo|bipolar|substance|alcohol|opioid|overdose|suicid/.test(c)) return 'psychiatry';
  if (/ob|gyn|pregnan|postpartum|ectopic|menstru|ovarian|uterine|endometr|pcos|menopause/.test(c)) return 'ob-gyn';
  if (/derm|rash|lesion|skin|psoriasis|eczema|melanoma|basal cell|squamous/.test(c)) return 'dermatology';
  if (/ortho|fracture|bone|joint|tendon|ligament|spine|back pain|knee|shoulder|hip\b/.test(c)) return 'orthopedics';
  if (/trauma|injury|burn|poison|toxic|overdose|ingest/.test(c)) return 'emergency/toxicology';
  return 'other';
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Full Bank Spine Scan ===\n');
  console.log('Total questions:', BANK.length);

  const used = loadSetAssignments();
  console.log('Assigned to sets:', used.size);
  console.log('Unassigned:', BANK.length - used.size);

  // Extract signatures
  console.log('\nExtracting demographics...');
  const signatures = [];
  const skipped = { noDemo: 0, noCondition: 0 };

  for (const q of BANK) {
    const stem = q.question || '';
    const age = extractAge(stem);
    const sex = extractSex(stem);
    if (age === null || sex === null) { skipped.noDemo++; }
    const condition = extractCondition(q);
    if (!condition || condition.length < 2) { skipped.noCondition++; }

    signatures.push({
      id: String(q.id),
      age,
      sex,
      condition,
      summary: extractSummary(q),
      question: stem,
    });
  }

  console.log('Total signatures:', signatures.length);
  console.log('Skipped (no demo):', skipped.noDemo, '| (no condition):', skipped.noCondition);

  // Type 1 clustering
  console.log('\nClustering Type 1 (exact patient repeats)...');
  const type1Clusters = clusterType1(signatures, used);
  console.log('Type 1 clusters found:', type1Clusters.length);

  if (type1Clusters.length > 0) {
    console.log('\nTop Type 1 clusters:');
    for (const c of type1Clusters.slice(0, 15)) {
      const assigned = c.assignedToSets.length > 0 ? ` [Sets: ${c.assignedToSets.join(',')}]` : ' [unassigned]';
      console.log(`  ${c.signature}  (${c.size} Qs)${assigned}${c.progression ? ' ★ progression' : ''}`);
    }
  }

  // Which QIDs are in Type 1
  const type1Ids = new Set();
  for (const c of type1Clusters) {
    for (const q of c.questions) type1Ids.add(q.id);
  }

  // Type 2 extraction
  console.log('\nExtracting Type 2 candidates...');
  const type2 = extractType2Candidates(signatures, type1Ids, used);
  console.log('Type 2 candidates:', type2.count);

  const categorySummary = Object.entries(type2.byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, qs]) => `${cat}: ${qs.length}`);
  console.log('Categories:', categorySummary.join(' | '));

  // Save intermediate data
  const output = {
    totalQuestions: BANK.length,
    assignedToSets: used.size,
    unassigned: BANK.length - used.size,
    totalSignatures: signatures.length,
    skippedNoDemo: skipped.noDemo,
    skippedNoCondition: skipped.noCondition,
    type1Clusters,
    type1Count: type1Clusters.reduce((a, c) => a + c.size, 0),
    type2Count: type2.count,
    type2ByCategory: Object.fromEntries(
      Object.entries(type2.byCategory).map(([cat, qs]) => [
        cat,
        {
          count: qs.length,
          // Only include summary + id for LLM review, not full question text (too large)
          sample: qs.slice(0, 20).map(s => ({
            id: s.id,
            age: s.age,
            sex: s.sex,
            condition: s.condition,
            summary: s.summary,
          })),
        },
      ])
    ),
    // Full unassigned signatures for the next phase
    unassignedSignatures: signatures
      .filter(s => !type1Ids.has(s.id))
      .map(s => ({
        id: s.id,
        age: s.age,
        sex: s.sex,
        condition: s.condition,
        summary: s.summary,
        category: categorizeCondition(s.condition),
      })),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2));
  console.log('\nWrote', OUT_JSON, `(${(fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1)} MB)`);

  // ── Generate markdown report ──
  let md = `# Spine Cluster Candidates — Full Bank Scan

**Generated:** ${new Date().toISOString()}
**Total questions:** ${BANK.length}
**Assigned to existing sets (1–20):** ${used.size}
**Unassigned:** ${BANK.length - used.size}

---

## Type 1: Exact Patient-Repeat Clusters

Clusters where age (±2 years), sex, and primary condition all match —
the same patient appearing in multiple CCS questions.
${type1Clusters.length === 0 ? '**None found** — this is normal across unrelated vignettes.' : ''}

`;

  for (const c of type1Clusters.slice(0, 30)) {
    const assigned = c.assignedToSets.length > 0
      ? `\`Sets ${c.assignedToSets.join(', ')}\``
      : '*unassigned*';
    const prog = c.progression ? ' ★ progression from diagnosis → complication/follow-up' : '';

    md += `### ${c.signature} (${c.size} Qs)${prog}
- **Assigned:** ${assigned}
- **Ages:** ${c.ages.join(', ')} · **Sex:** ${c.sex}

`;
    for (const q of c.questions.slice(0, 5)) {
      md += `| QID ${q.id} | ${q.assigned} | ${q.summary.replace(/\n/g, ' ').slice(0, 150)} |\n`;
    }
    if (c.questions.length > 5) md += `| … | … | *${c.questions.length - 5} more questions* |\n`;
    md += '\n---\n\n';
  }

  // Type 2 summary
  md += `## Type 2: Organic Encounter Candidates

${type2.count} questions don't have an exact patient-repeat match.
They need organic-connection proposals: a plausible setting, venue, trip, or life event
that puts an existing avatar in contact with the condition.

**Category breakdown:**
| Category | Count |
|----------|-------|
`;
  for (const [cat, data] of Object.entries(output.type2ByCategory).sort((a, b) => b[1].count - a[1].count)) {
    md += `| ${cat} | ${data.count} |\n`;
  }

  md += `
> **Next step:** Run Phase 2 (agent review) to propose organic encounters for each category,
> applying the travel-fit check before recommending new avatars.
> Full unassigned data: \`spine-cluster-data.json\`
`;

  fs.writeFileSync(OUT_MD, md);
  console.log('Wrote', OUT_MD);

  console.log('\nDone. Next: agent reviews spine-cluster-data.json for organic connections.');
}

main();
