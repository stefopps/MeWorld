/**
 * Runtime loader for approved scene element maps/layers.
 * Master catalog: dev/scene-elements/SCENE_ELEMENT_REGISTRY.json
 */
import registry from "../../dev/scene-elements/SCENE_ELEMENT_REGISTRY.json" with { type: "json" };

const byId = new Map(registry.elements.map((el) => [el.id, el]));

export const SCENE_ELEMENT_REGISTRY_VERSION = registry.version ?? 1;

/** @param {string} id */
export function resolveSceneElement(id) {
  return byId.get(id) ?? null;
}

/** All registered elements. */
export function listSceneElements() {
  return registry.elements.slice();
}

/** Elements with approved maps ready to load (skip regen). */
export function listApprovedSceneElements() {
  return registry.elements.filter((el) => el.characterMap?.status === "approved");
}

/** Elements still needing Pinterest/product ref + map gen. */
export function listPendingSceneElements() {
  return registry.elements.filter((el) => el.characterMap?.status !== "approved");
}

/**
 * Best path for compositing — approvedLayer.path, pickHero, or characterMap.path.
 * @param {string} id
 * @returns {string|null}
 */
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

/**
 * Build portrait prompt appendix listing loaded element refs (anti re-invent).
 * @param {string[]} ids
 */
export function buildSceneElementPromptBlock(ids) {
  const lines = [];
  for (const id of ids) {
    const el = resolveSceneElement(id);
    if (!el) continue;
    const path = getApprovedLayerPath(id);
    if (path) {
      lines.push(`- ${el.label}: use approved element map (${path}) — do not invent alternate hardware.`);
    } else if (el.characterMap?.status === "pending") {
      lines.push(`- ${el.label}: PENDING — search Pinterest/product per SCENE_ELEMENT_REGISTRY before gen.`);
    }
    if (el.antiSlop?.length) {
      lines.push(`  Avoid: ${el.antiSlop.slice(0, 4).join("; ")}.`);
    }
  }
  return lines.length ? `\nSCENE ELEMENT LOCK (load maps, do not slop):\n${lines.join("\n")}` : "";
}

export default registry;
