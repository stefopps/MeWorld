import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchOrderResult } from '../lib/orderResultApi.js';
import { resolveOrderResult, classifyOrderKind } from '../lib/orderResult.js';
import { isRepeatableLabLabel } from '../lib/labResultMetrics.js';

function resultTextKey(row) {
  return String(row?.text || '').replace(/\s+/g, ' ').trim();
}

function isLiveLabOrder(intervention) {
  const meta = classifyOrderKind(intervention?.label || '');
  return meta.kind === 'lab' || isRepeatableLabLabel(intervention?.label);
}

/**
 * Attendant-driven order results — labs always from /api/order-result (session occurrence).
 * Trajectory cases keep deterministic K+/ECG until LLM path applies.
 */
export function useOrderResult(
  intervention,
  { caseData, caseFlow, teachMeMode = false, orderLog = null, onResultStored = null } = {},
) {
  const fallback = useMemo(() => {
    if (!intervention?.label) return null;
    const trajectoryHit = resolveOrderResult(intervention, {
      caseData,
      caseFlow,
      teachMeMode,
      orderLog,
    });
    if (trajectoryHit?.trajectoryState) return trajectoryHit;

    if (isLiveLabOrder(intervention)) {
      const meta = classifyOrderKind(intervention.label);
      return {
        kind: meta.kind,
        kindLabel: meta.kindLabel || 'Lab result',
        text: 'Laboratory — awaiting attendant result…',
        pending: true,
      };
    }

    return (
      resolveOrderResult(intervention, {
        caseData,
        caseFlow,
        teachMeMode,
        orderLog,
        liveAttendantLabs: true,
      }) || {
        kind: 'order',
        kindLabel: 'Result',
        text: `${intervention.label} — completed.`,
      }
    );
  }, [intervention, caseData, caseFlow, teachMeMode, orderLog]);

  const trajectoryLocked = Boolean(fallback?.trajectoryState);
  const liveLab = isLiveLabOrder(intervention);

  const [result, setResult] = useState(fallback);
  const [source, setSource] = useState('fallback');
  const [fetching, setFetching] = useState(false);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    setResult(fallback);
    setSource(trajectoryLocked ? 'trajectory' : 'fallback');
  }, [intervention?.id, intervention?.trajectoryOccurrence, caseData?.id, fallback, trajectoryLocked]);

  useEffect(() => {
    if (!intervention?.id || !intervention?.label || !caseData?.id) return undefined;
    if (trajectoryLocked) return undefined;

    const gen = (fetchGenRef.current += 1);
    let cancelled = false;
    if (liveLab) setFetching(true);

    void fetchOrderResult({
      caseId: caseData.id,
      orderId: intervention.id,
      orderLabel: intervention.label,
      intervention,
      caseData,
      caseFlow,
      teachMeMode,
      playbookWhy: intervention.why || '',
      orderLog: orderLog || [],
      trajectoryOccurrence: intervention.trajectoryOccurrence ?? 0,
    }).then((row) => {
      if (cancelled || gen !== fetchGenRef.current) return;
      const next = {
        kind: row.kind || fallback?.kind || 'order',
        kindLabel: row.kindLabel || fallback?.kindLabel || 'Result',
        text: row.text || fallback?.text || '',
        storageKey: row.storageKey,
      };
      setResult((prev) => (resultTextKey(prev) === resultTextKey(next) ? prev : next));
      setSource(row.source || 'llm');
      onResultStored?.(next);
    });

    return () => {
      cancelled = true;
    };
  }, [
    intervention?.id,
    intervention?.label,
    intervention?.why,
    intervention?.trajectoryOccurrence,
    caseData?.id,
    teachMeMode,
    caseFlow,
    orderLog,
    trajectoryLocked,
    fallback,
    onResultStored,
  ]);

  const loading = liveLab && !trajectoryLocked && result?.pending && source === 'fallback';

  return { result, loading, source, fallback };
}
