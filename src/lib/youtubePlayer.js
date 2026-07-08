/** YouTube embed + postMessage seek helpers for Real World clips. */

export function formatYoutubeTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function youtubeEmbedUrl(youtubeId, { enableApi = true, startSeconds = 0 } = {}) {
  if (!youtubeId) return '';
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
  });
  if (enableApi) {
    params.set('enablejsapi', '1');
    if (typeof window !== 'undefined' && window.location?.origin) {
      params.set('origin', window.location.origin);
    }
  }
  if (startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;
}

export function seekYoutubeEmbed(iframe, seconds) {
  if (!iframe?.contentWindow) return;
  const t = Math.max(0, Number(seconds) || 0);
  const win = iframe.contentWindow;
  win.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [t, true] }), '*');
  win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
}

/** Merge short caption fragments into readable lines for scan + jump. */
export function mergeTranscriptCues(cues, { maxGap = 1.4, maxChars = 220 } = {}) {
  if (!Array.isArray(cues) || !cues.length) return [];
  const out = [];
  let cur = { start: cues[0].start, text: cues[0].text, dur: cues[0].dur ?? 0 };

  for (let i = 1; i < cues.length; i += 1) {
    const next = cues[i];
    const curEnd = cur.start + (cur.dur || 0);
    const gap = next.start - curEnd;
    const combined = `${cur.text} ${next.text}`.replace(/\s+/g, ' ').trim();
    if (gap <= maxGap && combined.length <= maxChars) {
      cur.text = combined;
      cur.dur = next.start + (next.dur || 0) - cur.start;
    } else {
      out.push(cur);
      cur = { start: next.start, text: next.text, dur: next.dur ?? 0 };
    }
  }
  out.push(cur);
  return out;
}
