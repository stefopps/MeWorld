/** Session cache: fetch mp4 → blob URL so browser download managers (e.g. IDM) don't see .mp4 in <video src>. */
const cache = new Map();
const inflight = new Map();

export async function resolvePrivateVideoSrc(assetPath) {
  if (!assetPath) return '';
  if (cache.has(assetPath)) return cache.get(assetPath);
  if (inflight.has(assetPath)) return inflight.get(assetPath);

  const promise = fetch(assetPath)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load video: ${assetPath}`);
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      cache.set(assetPath, url);
      inflight.delete(assetPath);
      return url;
    })
    .catch((err) => {
      inflight.delete(assetPath);
      console.warn('[privateVideoSrc]', err);
      return assetPath;
    });

  inflight.set(assetPath, promise);
  return promise;
}

export function preloadPrivateVideos(paths) {
  paths.filter(Boolean).forEach((path) => {
    resolvePrivateVideoSrc(path).catch(() => {});
  });
}

/** Spread onto <video> to discourage grab/download UI where supported. */
export const VIDEO_NO_DOWNLOAD_ATTRS = {
  controlsList: 'nodownload nofullscreen noremoteplayback',
  disablePictureInPicture: true,
  disableRemotePlayback: true,
};
