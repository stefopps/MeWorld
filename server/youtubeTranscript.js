/** Fetch auto-generated or manual YouTube captions (English preferred). */
export async function fetchYoutubeTranscript(videoId) {
  const id = String(videoId || '').trim();
  if (!id || id.includes(' ')) throw new Error('Invalid YouTube video id');

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!watchRes.ok) throw new Error('Could not load YouTube page');
  const html = await watchRes.text();

  const captionMatch = html.match(/"captionTracks":(\[[\s\S]*?\])/);
  if (!captionMatch) throw new Error('No captions for this video');

  let tracks;
  try {
    tracks = JSON.parse(captionMatch[1].replace(/\\u0026/g, '&'));
  } catch {
    throw new Error('Could not parse caption tracks');
  }

  const track =
    tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find((t) => String(t.languageCode || '').startsWith('en')) ||
    tracks[0];
  if (!track?.baseUrl) throw new Error('No usable caption track');

  const capRes = await fetch(track.baseUrl);
  if (!capRes.ok) throw new Error('Could not download captions');
  const xml = await capRes.text();

  const chunks = [];
  const cues = [];
  const blockRe = /<text([^>]*)>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = blockRe.exec(xml))) {
    const attrs = m[1] || '';
    const start = Number.parseFloat((attrs.match(/start="([^"]+)"/) || [])[1]);
    const dur = Number.parseFloat((attrs.match(/dur="([^"]+)"/) || [])[1]) || 0;
    const raw = m[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (!raw) continue;
    chunks.push(raw);
    cues.push({
      start: Number.isFinite(start) ? start : cues.length,
      dur,
      text: raw,
    });
  }

  const text = chunks.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Caption track was empty');
  return { text, cues, language: track.languageCode || 'en' };
}
