import orderWhyPlaybook from '../data/orderWhyPlaybook.json' with { type: 'json' };
import { FIRST_AID_STEP1_2025 } from './referenceBooks.js';
import { apiUrl } from './apiBase.js';

const FIRST_AID_PAGE_RE = /first aid\s+p\.?\s*(\d+(?:\s*[-–]\s*\d+)?)/gi;

function uniquePages(pages) {
  const seen = new Set();
  const out = [];
  for (const p of pages) {
    const key = String(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function extractFirstAidPagesFromText(text) {
  const pages = [];
  if (!text) return pages;
  let match;
  const re = new RegExp(FIRST_AID_PAGE_RE.source, FIRST_AID_PAGE_RE.flags);
  while ((match = re.exec(text)) !== null) {
    pages.push(match[1].replace(/\s+/g, ''));
  }
  return pages;
}

function collectPlaybookRefs(caseId) {
  const block = orderWhyPlaybook?.cases?.[String(caseId)];
  if (!block || typeof block !== 'object') return { pages: [], orders: [] };
  const pages = [];
  const orders = [];
  for (const [orderId, entry] of Object.entries(block)) {
    const why = String(entry?.why || '');
    const label = entry?.orderLabel || orderId;
    const found = extractFirstAidPagesFromText(why);
    if (found.length) {
      orders.push({ orderId, label, pages: found, excerpt: why.slice(0, 220) });
      pages.push(...found);
    }
  }
  return { pages: uniquePages(pages), orders };
}

/** Build bibliography sections for settings / info panel. */
export function buildCaseBibliography(caseData = {}) {
  const sections = [];
  const caseId = String(caseData?.id ?? '').trim();
  const uber = caseData?.uberMeta;

  if (uber?.segments?.length) {
    sections.push({
      id: 'composition',
      title: 'How this case is composed',
      items: uber.segments.map((seg) => ({
        id: `seg-${seg.id || seg.ccsNumber}`,
        label: seg.label,
        ref: `CCS #${seg.ccsNumber}`,
        note: uber.briefingNote || '',
        kind: 'ccs-thread',
      })),
    });
  } else if (uber?.memberCaseIds?.length) {
    sections.push({
      id: 'composition',
      title: 'How this case is composed',
      items: uber.memberCaseIds.map((mid, i) => ({
        id: `member-${mid}`,
        label: uber.segments?.[i]?.label || `Thread ${i + 1}`,
        ref: `CCS #${String(mid).replace(/^0+/, '')}`,
        kind: 'ccs-thread',
      })),
    });
  }

  const playbook = collectPlaybookRefs(caseId);
  if (playbook.pages?.length) {
    sections.push({
      id: 'first-aid',
      title: 'First Aid — relevant pages',
      pdfUrl: apiUrl('/reference/first-aid/pdf'),
      pdfTitle: FIRST_AID_STEP1_2025.id,
      items: playbook.pages.map((page) => ({
        id: `fa-p${page}`,
        label: `Page ${page}`,
        ref: 'First Aid Step 1 (2025)',
        kind: 'first-aid-page',
        href: apiUrl(`/reference/first-aid/pdf#page=${page}`),
      })),
    });
  }

  if (playbook.orders?.length) {
    sections.push({
      id: 'attending-sources',
      title: 'Attending teaching — order sources',
      items: playbook.orders.map((row) => ({
        id: `why-${row.orderId}`,
        label: row.label,
        ref: row.pages.length ? `First Aid p. ${row.pages.join(', p. ')}` : 'Playbook',
        note: row.excerpt,
        kind: 'order-why',
      })),
    });
  }

  if (caseData?.caseBankSource) {
    sections.push({
      id: 'case-bank',
      title: 'Case bank',
      items: [
        {
          id: 'bank-source',
          label: String(caseData.diagnosis || caseData.title || 'Prepared case'),
          ref: caseData.caseBankSource,
          kind: 'metadata',
        },
      ],
    });
  }

  if (caseData?.playbookKey && !sections.some((s) => s.id === 'composition')) {
    sections.push({
      id: 'presentation',
      title: 'Presentation source',
      items: [
        {
          id: 'playbook-key',
          label: caseData.presentationKey || caseData.title || caseId,
          ref: caseData.playbookKey,
          kind: 'metadata',
        },
      ],
    });
  }

  return { caseId, sections };
}

export function caseHasBibliography(caseData = {}) {
  return buildCaseBibliography(caseData).sections.length > 0;
}
