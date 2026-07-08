import bakedCatalog from '../data/caseExplainersBaked.json' with { type: 'json' };

export function explainerKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120);
}

function caseBucket(caseId) {
  const raw = String(caseId ?? '').replace(/^case_/i, '').trim();
  const num = raw.replace(/^0+/, '') || raw;
  const padded = /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
  return (
    bakedCatalog.byCaseId?.[num] ||
    bakedCatalog.byCaseId?.[raw] ||
    bakedCatalog.byCaseId?.[padded] ||
    null
  );
}

export function getBakedOrderWhy(caseId, orderId) {
  const bucket = caseBucket(caseId);
  if (!bucket?.orders) return null;
  const key = String(orderId || '').trim();
  const row = bucket.orders[key] || bucket.orders[explainerKey(key)];
  return row?.why ? { why: row.why, source: row.source || 'baked' } : null;
}

export function getBakedDifferentialExplain(caseId, diagnosis) {
  const bucket = caseBucket(caseId);
  if (!bucket?.diagnoses) return null;
  const key = explainerKey(diagnosis);
  const row = bucket.diagnoses[key] || bucket.diagnoses[String(diagnosis || '').trim()];
  if (!row?.hook) return null;
  return { ...row, source: row.source || 'baked' };
}

export function hasBakedExplainers(caseId) {
  const bucket = caseBucket(caseId);
  if (!bucket) return false;
  const orderCount = bucket.orders ? Object.keys(bucket.orders).length : 0;
  const dxCount = bucket.diagnoses ? Object.keys(bucket.diagnoses).length : 0;
  return orderCount + dxCount > 0;
}

export function bakedCatalogMeta() {
  return {
    version: bakedCatalog.version,
    caseCount: bakedCatalog.caseCount || 0,
    exportedAt: bakedCatalog.exportedAt,
  };
}
