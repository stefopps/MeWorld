// FINAL: Appends NBME text-bank entries to text-bank.jsonl and adds nodes to graph-data-set files

const fs = require("fs");
const path = require("path");

const BANK_DIR = path.join(__dirname);

// ── Load NBME text-bank entries ──
const nbmeEntries = fs.readFileSync(path.join(BANK_DIR, "_nbme-text-bank.jsonl"), "utf8")
  .split("\n").filter(l => l.trim()).map(l => JSON.parse(l));

console.log(`Loading ${nbmeEntries.length} NBME text-bank entries`);

// Load and re-parse all NBME data for diagnosis info
const nbmeData = JSON.parse(fs.readFileSync(path.join(BANK_DIR, "_nbme-parsed.json"), "utf8"));

// Map new IDs to diagnoses
// We need to track: for each new text-bank entry ID, what is the diagnosis
const idToDiagnosis = {};
const textBankIds = nbmeEntries.map(e => String(e.id));
let nextIdx = 0;
for (const q of nbmeData) {
  if (nextIdx < textBankIds.length) {
    idToDiagnosis[textBankIds[nextIdx]] = q.diagnosis;
    nextIdx++;
  }
}

// ── Load cluster assignments ──
const clusterAssignments = JSON.parse(fs.readFileSync(path.join(BANK_DIR, "_nbme-cluster-assignments.json"), "utf8"));

// ── 1. Append to text-bank.jsonl ──
const textBankPath = path.join(BANK_DIR, "text-bank.jsonl");
const existingContent = fs.readFileSync(textBankPath, "utf8");
const needsTrailing = !existingContent.endsWith("\n");
const appendContent = (needsTrailing ? "\n" : "") + nbmeEntries.map(e => JSON.stringify(e)).join("\n") + "\n";

fs.appendFileSync(textBankPath, appendContent);
console.log(`Appended ${nbmeEntries.length} entries to text-bank.jsonl`);

// ── 2. Add nodes to graph-data-set files ──
let totalNodes = 0;
const setsModified = [];

for (const [setId, nodes] of Object.entries(clusterAssignments)) {
  const graphPath = path.join(BANK_DIR, `graph-data-set-${String(setId).padStart(2, "0")}.json`);
  if (!fs.existsSync(graphPath)) {
    console.log(`WARNING: No graph file for Set ${setId}: ${graphPath}`);
    continue;
  }

  const graphData = JSON.parse(fs.readFileSync(graphPath, "utf8"));

  // Filter out fix entries and keep only real entries with valid new IDs
  const realNodes = nodes.filter(n => n.id && n.id.match(/^\d+$/));
  if (realNodes.length === 0) continue;

  // Add each node as a 'thread' category (NBME questions enrich existing clusters)
  for (const node of realNodes) {
    graphData.nodes.push({
      id: node.id,
      category: "thread",
      why: `NBME ${node.form.replace('step2ck_', '')}: ${node.diagnosis}`
    });
    totalNodes++;
  }

  // Update counts
  if (!graphData.counts) graphData.counts = { primary: 0, mimic: 0, thread: 0 };
  graphData.counts.thread = (graphData.counts.thread || 0) + realNodes.length;

  fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 4));
  setsModified.push(setId);
  console.log(`  Set ${setId} (${graphData.coreDiagnosis}): +${realNodes.length} nodes`);
}

console.log(`\n=== DONE ===`);
console.log(`Text-bank entries appended: ${nbmeEntries.length}`);
console.log(`Graph nodes added: ${totalNodes}`);
console.log(`Sets modified: ${setsModified.length}`);
console.log(`Sets: ${setsModified.join(", ")}`);
