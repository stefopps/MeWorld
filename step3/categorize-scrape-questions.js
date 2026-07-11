#!/usr/bin/env node
/**
 * Categorize scrape questions by topic (question stem only).
 * Usage: node categorize-scrape-questions.js
 */

const fs = require('fs');
const path = require('path');

const FILES = [
  'C:/Users/steve/Downloads/scrape-export/scrape-output-(7)/data-linked.json',
  'C:/Users/steve/Downloads/scrape-export/scrape-output-q49-50/data-linked.json',
];

// Manual primary topic per question number (from question stems)
const PRIMARY = {
  1: 'Psychiatry — PTSD / pharmacotherapy',
  2: 'Psychiatry — PTSD / psychotherapy & meds',
  3: 'Health Systems — Clinical decision support',
  4: 'Preventive Medicine — Weight-inclusive / metabolic care',
  5: 'Gastroenterology — Biliary / RUQ pain',
  6: 'Preventive Medicine — CV risk / lifestyle counseling',
  7: 'Pediatrics — Newborn / delivery complications',
  8: 'Cardiology — Valvular / syncope (likely AS)',
  9: 'Endocrinology — Diabetes management',
  10: 'Infectious Disease — HIV / opportunistic care',
  11: 'Orthopedics / Pediatrics — Hip pain',
  12: 'Sports Medicine — Endurance athlete nutrition',
  13: 'Urology — Urinary incontinence',
  14: 'Gastroenterology — Alcohol withdrawal / hepatic',
  15: 'Psychiatry — Depression',
  16: 'Preventive Medicine — Alcohol use counseling',
  17: 'Hematology / Pediatrics — Bleeding / bruising',
  18: 'Endocrinology / Emergency — Metformin toxicity / AKI',
  19: 'Psychiatry — Specific phobia',
  20: 'Rheumatology — Granulomatosis / vasculitis (likely)',
  21: 'Pediatrics — Umbilical hernia',
  22: 'Emergency / OB-GYN — Adolescent abdominal pain (torsion)',
  23: 'Health Systems — Patient safety / team communication',
  24: 'Rheumatology — RA / immunosuppression complications',
  25: 'Preventive Medicine — Lipids / diet counseling',
  26: 'Rheumatology / ENT — Granulomatosis pattern',
  27: 'Cardiology — Pre-op / anticoagulation (valve surgery)',
  28: 'Oncology — Metastatic disease / back pain',
  29: 'Orthopedics / Pediatrics — Back pain',
  30: 'Neurology / Pediatrics — Seizures / absence',
  31: 'Preventive Medicine — Screening / annual exam',
  32: 'Hematology / Ethics — Friend as patient / cytopenias',
  33: 'Neurology / Sports — Concussion',
  34: 'OB-GYN — Postpartum complication',
  35: 'Geriatrics / Orthopedics — Back pain screening',
  36: 'Emergency / GI — Acute abdominal / thoracic pain',
  37: 'Psychiatry — Schizoaffective / medical admission',
  38: 'Psychiatry — Delusional disorder / shared psychosis',
  39: 'Dermatology / Pediatrics — Bullous skin disease / infection',
  40: 'OB-GYN / Rheumatology — Pregnancy + autoimmune',
  41: 'Gastroenterology — Abdominal pain / sedentary adult',
  42: 'Cardiology — Heart failure / anticoagulation',
  43: 'Cardiology — Heart failure / dyspnea',
  44: 'Toxicology / Emergency — Snake envenomation',
  45: 'Rheumatology — RA screening / monitoring',
  46: 'Cardiology — Amiodarone / thyroid toxicity',
  47: 'Endocrinology / Rheumatology — Fatigue / autoimmune workup',
  48: 'Emergency / Trauma — Motorcycle accident',
  49: 'Endocrinology — Amiodarone-induced hypothyroidism',
  50: 'Cardiology — Heart failure / dietary sodium',
};

const SYSTEM = {
  'Psychiatry — PTSD / pharmacotherapy': 'Psychiatry',
  'Psychiatry — PTSD / psychotherapy & meds': 'Psychiatry',
  'Psychiatry — Depression': 'Psychiatry',
  'Psychiatry — Specific phobia': 'Psychiatry',
  'Psychiatry — Schizoaffective / medical admission': 'Psychiatry',
  'Psychiatry — Delusional disorder / shared psychosis': 'Psychiatry',
  'Health Systems — Clinical decision support': 'Health Systems / Quality',
  'Health Systems — Patient safety / team communication': 'Health Systems / Quality',
  'Preventive Medicine — Weight-inclusive / metabolic care': 'Preventive Medicine',
  'Preventive Medicine — CV risk / lifestyle counseling': 'Preventive Medicine',
  'Preventive Medicine — Alcohol use counseling': 'Preventive Medicine',
  'Preventive Medicine — Lipids / diet counseling': 'Preventive Medicine',
  'Preventive Medicine — Screening / annual exam': 'Preventive Medicine',
  'Gastroenterology — Biliary / RUQ pain': 'Gastroenterology',
  'Gastroenterology — Alcohol withdrawal / hepatic': 'Gastroenterology',
  'Gastroenterology — Abdominal pain / sedentary adult': 'Gastroenterology',
  'Pediatrics — Newborn / delivery complications': 'Pediatrics',
  'Pediatrics — Umbilical hernia': 'Pediatrics',
  'Orthopedics / Pediatrics — Hip pain': 'Pediatrics / MSK',
  'Orthopedics / Pediatrics — Back pain': 'Pediatrics / MSK',
  'Neurology / Pediatrics — Seizures / absence': 'Neurology / Pediatrics',
  'Dermatology / Pediatrics — Bullous skin disease / infection': 'Dermatology / Pediatrics',
  'Hematology / Pediatrics — Bleeding / bruising': 'Hematology',
  'Cardiology — Valvular / syncope (likely AS)': 'Cardiology',
  'Cardiology — Pre-op / anticoagulation (valve surgery)': 'Cardiology',
  'Cardiology — Heart failure / anticoagulation': 'Cardiology',
  'Cardiology — Heart failure / dyspnea': 'Cardiology',
  'Cardiology — Amiodarone / thyroid toxicity': 'Cardiology',
  'Cardiology — Heart failure / dietary sodium': 'Cardiology',
  'Endocrinology — Diabetes management': 'Endocrinology',
  'Endocrinology / Emergency — Metformin toxicity / AKI': 'Endocrinology',
  'Endocrinology — Amiodarone-induced hypothyroidism': 'Endocrinology',
  'Endocrinology / Rheumatology — Fatigue / autoimmune workup': 'Endocrinology',
  'Infectious Disease — HIV / opportunistic care': 'Infectious Disease',
  'Sports Medicine — Endurance athlete nutrition': 'Sports / Nutrition',
  'Urology — Urinary incontinence': 'Urology',
  'Rheumatology — Granulomatosis / vasculitis (likely)': 'Rheumatology',
  'Rheumatology / ENT — Granulomatosis pattern': 'Rheumatology',
  'Rheumatology — RA / immunosuppression complications': 'Rheumatology',
  'Rheumatology — RA screening / monitoring': 'Rheumatology',
  'OB-GYN — Postpartum complication': 'OB-GYN',
  'OB-GYN / Rheumatology — Pregnancy + autoimmune': 'OB-GYN',
  'Emergency / OB-GYN — Adolescent abdominal pain (torsion)': 'OB-GYN / Emergency',
  'Oncology — Metastatic disease / back pain': 'Oncology',
  'Neurology / Sports — Concussion': 'Neurology',
  'Geriatrics / Orthopedics — Back pain screening': 'Geriatrics',
  'Emergency / GI — Acute abdominal / thoracic pain': 'Emergency Medicine',
  'Hematology / Ethics — Friend as patient / cytopenias': 'Hematology / Ethics',
  'Toxicology / Emergency — Snake envenomation': 'Toxicology / Emergency',
  'Emergency / Trauma — Motorcycle accident': 'Emergency / Trauma',
};

function getBestPage(pages) {
  const byNum = new Map();
  for (const page of pages) {
    const src = page.afterClick || page.reveal || page.beforeClick || page;
    const num = parseInt(String(src.questionNumber || page.questionNumber || '').split('/')[0], 10);
    if (!Number.isFinite(num)) continue;
    const text = [src.question, src.explanation, src.fullText].filter(Boolean).join('\n');
    const prev = byNum.get(num);
    if (!prev || text.length > prev.text.length) {
      byNum.set(num, {
        num,
        id: (src.questionId || '').replace('Question ID:', '').trim(),
        question: (src.question || '').trim(),
        text,
      });
    }
  }
  return [...byNum.values()].sort((a, b) => a.num - b.num);
}

const pages = [];
for (const f of FILES) {
  pages.push(...(JSON.parse(fs.readFileSync(f, 'utf8')).pages || []));
}

const questions = getBestPage(pages).map((q) => ({
  ...q,
  topic: PRIMARY[q.num] || 'Uncategorized',
  system: SYSTEM[PRIMARY[q.num]] || 'Other',
}));

const bySystem = {};
const byTopic = {};
for (const q of questions) {
  bySystem[q.system] = (bySystem[q.system] || 0) + 1;
  byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
}

const outDir = 'C:/Users/steve/Downloads/scrape-export/topic-analysis';
fs.mkdirSync(outDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  totalQuestions: questions.length,
  distinctSystems: Object.keys(bySystem).length,
  distinctTopics: Object.keys(byTopic).length,
  bySystem: Object.entries(bySystem)
    .sort((a, b) => b[1] - a[1])
    .map(([system, count]) => ({ system, count })),
  byTopic: Object.entries(byTopic)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count })),
  questions: questions.map((q) => ({
    num: q.num,
    id: q.id,
    system: q.system,
    topic: q.topic,
    questionPreview: (q.question || q.text).replace(/\s+/g, ' ').slice(0, 200),
  })),
};

fs.writeFileSync(path.join(outDir, 'topic-report.json'), JSON.stringify(report, null, 2));

let md = `# Topic Analysis — 50 Questions\n\n`;
md += `**Total questions:** ${report.totalQuestions}\n\n`;
md += `**Distinct systems:** ${report.distinctSystems}\n\n`;
md += `**Distinct subtopics:** ${report.distinctTopics}\n\n`;
md += `## By System\n\n| System | Count |\n|--------|-------|\n`;
for (const { system, count } of report.bySystem) md += `| ${system} | ${count} |\n`;
md += `\n## By Topic\n\n| Topic | Count |\n|-------|-------|\n`;
for (const { topic, count } of report.byTopic) md += `| ${topic} | ${count} |\n`;
md += `\n## All Questions\n\n| Q# | ID | System | Topic |\n|----|-----|--------|-------|\n`;
for (const q of report.questions) {
  md += `| ${q.num} | ${q.id} | ${q.system} | ${q.topic} |\n`;
}

fs.writeFileSync(path.join(outDir, 'topic-report.md'), md);

console.log('Total questions:', report.totalQuestions);
console.log('Distinct systems:', report.distinctSystems);
console.log('Distinct subtopics:', report.distinctTopics);
console.log('\nBy system:');
for (const { system, count } of report.bySystem) console.log(`  ${count}x  ${system}`);
console.log('\nSaved:', path.join(outDir, 'topic-report.json'));
console.log('Saved:', path.join(outDir, 'topic-report.md'));
