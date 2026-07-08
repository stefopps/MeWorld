/** True when launched via `npm run dev:study` or `npm run dev:study:alt` (frozen snapshot). */
export function isStudyEnvironment() {
  return import.meta.env.VITE_STUDY_MODE === '1';
}

export function getStudyServerUrls() {
  if (typeof window === 'undefined') {
    const webPort = import.meta.env.VITE_DEV_PORT || '5173';
    const apiPort = import.meta.env.VITE_API_PORT || '3001';
    return {
      web: `http://localhost:${webPort}`,
      api: `http://127.0.0.1:${apiPort}`,
    };
  }
  const { origin, port } = window.location;
  const apiPort = import.meta.env.VITE_API_PORT || (port === '5174' ? '3002' : '3001');
  return {
    web: origin,
    api: `http://127.0.0.1:${apiPort}`,
  };
}

const DEFAULT_META = {
  snapshotAt: null,
  mainDevWeb: 'http://localhost:5174',
  mainDevApi: 'http://127.0.0.1:3002',
  refreshCadenceDays: 7,
};

let cachedMeta = null;
let metaPromise = null;

/** Snapshot stamp from `public/study-environment.json` (written by create-study-snapshot.ps1). */
export async function loadStudyEnvironmentMeta() {
  if (!isStudyEnvironment()) return DEFAULT_META;
  if (cachedMeta) return cachedMeta;
  if (!metaPromise) {
    metaPromise = fetch('/study-environment.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : DEFAULT_META))
      .catch(() => DEFAULT_META)
      .then((data) => {
        cachedMeta = { ...DEFAULT_META, ...data };
        return cachedMeta;
      });
  }
  return metaPromise;
}
