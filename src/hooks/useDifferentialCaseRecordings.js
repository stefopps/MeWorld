import { useCallback, useEffect, useState } from 'react';
import { fetchCaseUserData } from '../lib/caseUserLog.js';
import {
  getLocalDifferentialRecordingUrl,
  listAllDifferentialRecordings,
  listLocalDifferentialRecordings,
  localRecordingKey,
  resolveRecordingPlaybackSrc,
} from '../lib/differentialVoiceStorage.js';

export function useDifferentialCaseRecordings(caseId, version = 0) {
  const [rows, setRows] = useState([]);
  const [localUrls, setLocalUrls] = useState({});
  const [serverData, setServerData] = useState(null);
  const [blobsReady, setBlobsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urlsToRevoke = [];

    setRows(listAllDifferentialRecordings(caseId, null));
    setLocalUrls({});
    setServerData(null);
    setBlobsReady(false);

    const local = listLocalDifferentialRecordings(caseId);

    (async () => {
      const urlMap = {};
      for (const rec of local) {
        const key = localRecordingKey(rec);
        if (!key) continue;
        const url = await getLocalDifferentialRecordingUrl(key);
        if (url) {
          urlMap[key] = url;
          urlsToRevoke.push(url);
        }
      }
      if (!cancelled) {
        setLocalUrls(urlMap);
        setBlobsReady(true);
      }
    })();

    (async () => {
      const server = await fetchCaseUserData(caseId, { timeoutMs: 2500 });
      if (cancelled) return;
      setServerData(server);
      setRows(listAllDifferentialRecordings(caseId, server));
    })();

    return () => {
      cancelled = true;
      urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [caseId, version]);

  const resolveSrc = useCallback(
    (rec) => resolveRecordingPlaybackSrc(caseId, rec, localUrls, serverData),
    [caseId, localUrls, serverData],
  );

  return { recordings: rows, resolveSrc, blobsReady };
}
