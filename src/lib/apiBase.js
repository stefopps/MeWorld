/**
 * API base URL for browser fetches.
 * - Local dev: '' (Vite proxies /api → :3001)
 * - Render full-stack: same origin (SERVE_STATIC=1)
 * - Vercel + API host: set VITE_API_BASE at build time
 */
export function getApiBase() {
  const configured = import.meta.env?.VITE_API_BASE;
  if (configured) return String(configured).replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location?.origin) {
    if (import.meta.env?.DEV) return '';
    return window.location.origin;
  }

  return 'http://127.0.0.1:3001';
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${p}` : p;
}
