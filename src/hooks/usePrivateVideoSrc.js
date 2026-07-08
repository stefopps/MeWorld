import { useEffect, useState } from 'react';
import { resolvePrivateVideoSrc } from '../lib/privateVideoSrc.js';

export function usePrivateVideoSrc(assetPath) {
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    if (!assetPath) {
      setResolved('');
      return undefined;
    }

    let cancelled = false;
    resolvePrivateVideoSrc(assetPath).then((url) => {
      if (!cancelled) setResolved(url);
    });

    return () => {
      cancelled = true;
    };
  }, [assetPath]);

  return resolved;
}
