const ORDER_EVENT_TYPES = new Set(['stack', 'extra_order', 'location']);

export function isOrderTimelineEvent(event) {
  return ORDER_EVENT_TYPES.has(event?.type);
}

export function orderTimelineEntryFromEvent(event, { orderIndex = null } = {}) {
  if (!event) return null;
  const at = Date.now();
  if (event.type === 'stack') {
    return {
      id: `order-${at}-${event.stackId || event.label}`,
      at,
      label: event.label || 'Order',
      kind: 'order',
      orderIndex,
      stackId: event.stackId || null,
    };
  }
  if (event.type === 'extra_order') {
    return {
      id: `extra-${at}-${event.label}`,
      at,
      label: event.label || 'Order',
      kind: 'extra',
      orderIndex,
      stackId: null,
    };
  }
  if (event.type === 'location') {
    return {
      id: `xfer-${at}-${event.location || event.label}`,
      at,
      label: event.label || `Transfer to ${event.location}`,
      kind: 'transfer',
      orderIndex: null,
    };
  }
  return null;
}

export function rebuildOrderTimelineFromCheckpoint({
  placementOrder = [],
  extraOrders = [],
  interventionById = {},
  sessionStartedAt = Date.now(),
}) {
  const events = [];
  placementOrder.forEach((stackId, idx) => {
    const iv = interventionById[stackId];
    events.push({
      id: `resume-order-${stackId}`,
      at: sessionStartedAt + (idx + 1) * 1000,
      label: iv?.label || stackId,
      kind: 'order',
      orderIndex: idx + 1,
      stackId,
    });
  });
  const base = sessionStartedAt + placementOrder.length * 1000;
  extraOrders.forEach((order, idx) => {
    events.push({
      id: `resume-extra-${order.name}-${idx}`,
      at: base + (idx + 1) * 1000,
      label: order.name,
      kind: 'extra',
      orderIndex: placementOrder.length + idx + 1,
      stackId: null,
    });
  });
  return events;
}

export function orderTimelineFromServerSession(session) {
  if (!session?.timeline?.length) return [];
  const startedMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  let orderIndex = 0;
  return session.timeline
    .map((ev) => {
      const at = ev.at ? new Date(ev.at).getTime() : startedMs;
      if (ev.type === 'stack') {
        orderIndex += 1;
        return {
          id: `srv-stack-${ev.stackId || ev.label}-${at}`,
          at,
          label: ev.label || 'Order',
          kind: 'order',
          orderIndex,
          stackId: ev.stackId || null,
        };
      }
      if (ev.type === 'extra_order') {
        orderIndex += 1;
        return {
          id: `srv-extra-${ev.label}-${at}`,
          at,
          label: ev.label || 'Order',
          kind: 'extra',
          orderIndex,
          stackId: null,
        };
      }
      if (ev.type === 'location') {
        return {
          id: `srv-xfer-${ev.location || ev.label}-${at}`,
          at,
          label: ev.label || `Transfer to ${ev.location}`,
          kind: 'transfer',
          orderIndex: null,
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normTimelineLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase();
}

/** Collapse duplicate rows from checkpoint/local/server sync (different ids, same event). */
export function dedupeOrderTimeline(events = []) {
  const out = [];
  for (const ev of events) {
    if (!ev) continue;
    const label = normTimelineLabel(ev.label);
    const kind = ev.kind || 'order';
    const at = ev.at || 0;
    const dupe = out.find(
      (row) =>
        (row.kind || 'order') === kind &&
        normTimelineLabel(row.label) === label &&
        Math.abs((row.at || 0) - at) < 5000,
    );
    if (!dupe) {
      out.push(ev);
      continue;
    }
    if (at < (dupe.at || 0)) {
      const idx = out.indexOf(dupe);
      out[idx] = ev;
    }
  }
  return out.sort((a, b) => (a.at || 0) - (b.at || 0));
}

/** Prefer the richest timeline, then dedupe cross-source duplicates. */
export function pickBestOrderTimeline(...candidates) {
  const lists = candidates
    .filter((rows) => Array.isArray(rows) && rows.length)
    .map((rows) => [...rows]);
  if (!lists.length) return [];
  lists.sort((a, b) => b.length - a.length);
  const merged = [...lists[0]];
  const seenIds = new Set(merged.map((ev) => ev.id));
  for (let i = 1; i < lists.length; i += 1) {
    for (const ev of lists[i]) {
      if (!seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        merged.push(ev);
      }
    }
  }
  return dedupeOrderTimeline(merged);
}

/** Sort timeline events into a stable ordered sequence for the sequence player.
 *  Returns events sorted by orderIndex then at, with a fresh seq number. */
export function orderTimelineSequenceFromEvents(events = []) {
  const orderEvents = events.filter((ev) => ev.kind === 'order');
  if (!orderEvents.length) return [];

  // Sort by orderIndex (assigned at placement time), then by at timestamp
  const sorted = [...orderEvents].sort((a, b) => {
    if (a.orderIndex != null && b.orderIndex != null) return a.orderIndex - b.orderIndex;
    if (a.orderIndex != null) return -1;
    if (b.orderIndex != null) return 1;
    return (a.at || 0) - (b.at || 0);
  });

  return sorted.map((ev, i) => ({ ...ev, seq: i + 1 }));
}
