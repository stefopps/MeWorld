/**
 * Server-side scene element registry loader (reads dev JSON from disk).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(root, "dev/scene-elements/SCENE_ELEMENT_REGISTRY.json");

let cached = null;

function loadRegistry() {
  if (!cached) {
    cached = JSON.parse(readFileSync(registryPath, "utf8"));
  }
  return cached;
}

/** @param {string} id */
export function resolveSceneElement(id) {
  return loadRegistry().elements.find((el) => el.id === id) ?? null;
}

/** @param {string} id */
export function getApprovedLayerPath(id) {
  const el = resolveSceneElement(id);
  if (!el) return null;

  const layer = el.approvedLayer?.path ?? el.approvedLayer?.pickHero;
  if (layer) return layer;

  const mapPath = el.characterMap?.path;
  if (mapPath && el.characterMap?.status === "approved" && !mapPath.endsWith("/")) {
    return mapPath;
  }

  return el.approvedLayer?.fallback ?? null;
}

/** @param {string[]} ids */
export function buildSceneElementPromptBlock(ids) {
  const lines = [];
  for (const id of ids) {
    const el = resolveSceneElement(id);
    if (!el) continue;
    const path = getApprovedLayerPath(id);
    if (path) {
      lines.push(
        `- ${el.label}: use approved element map (${path}) — do not invent alternate hardware.`,
      );
    } else if (el.characterMap?.status === "approved" && el.characterMap?.role?.includes("baked")) {
      lines.push(`- ${el.label}: locked in approved baseplate — preserve geometry from reference bed plate.`);
    } else if (el.characterMap?.status === "pending") {
      lines.push(
        `- ${el.label}: match real product refs in SCENE_ELEMENT_REGISTRY — no fantasy props.`,
      );
    }
    if (el.antiSlop?.length) {
      lines.push(`  Avoid: ${el.antiSlop.slice(0, 4).join("; ")}.`);
    }
  }
  return lines.length
    ? `\nSCENE ELEMENT LOCK (load maps, do not slop):\n${lines.join("\n")}`
    : "";
}

/** @param {object} caseContext @param {string} variant */
export function sceneElementIdsForPortrait(caseContext = {}, variant = "base") {
  const demo = caseContext.patientDemographics || {};
  const facts = caseContext.patientFacts || {};
  const sex = String(demo.sex || facts.sex || caseContext.sex || "male").toLowerCase();
  const ped = Boolean(demo.isPediatric || facts.isPediatric);

  const ids = [
    "ed-stretcher-hillrom",
    "hospital-gown-blue-short-sleeve",
    "hospital-pillow-white",
    "bedside-overbed-table",
    "bed-rail-control-panel",
    "ed-background-clinical-bokeh",
  ];

  if (ped && sex === "female") ids.push("patient-ped-female");
  else if (ped) ids.push("patient-ped-male");
  else if (sex === "female") ids.push("patient-adult-female");
  else ids.push("patient-adult-male");

  if (variant === "iv") ids.push("iv-bd-insyte-20g-antecubital");

  return ids;
}

export function getSceneElementRegistryVersion() {
  return loadRegistry().version ?? 1;
}
