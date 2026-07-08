import { apiUrl } from './apiBase.js';

/** Opens the CCS review screenshot for this case number in a new tab. */
export function ccsScreenshotUrl(caseNum) {
  const n = parseInt(String(caseNum ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return apiUrl(`/api/ccs-screenshot/${n}`);
}

export function openCcsScreenshot(caseNum) {
  const url = ccsScreenshotUrl(caseNum);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
