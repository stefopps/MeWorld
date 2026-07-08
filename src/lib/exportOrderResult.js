import { neutralStackOrderName } from './stackDecoys.js';
import { resolveOrderResult } from './orderResult.js';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOrderResultPrintPayload({
  intervention,
  caseData,
  caseFlow,
  portraitSrc = '',
  teachMeMode = false,
  resultOverride = null,
}) {
  const result =
    resultOverride ||
    resolveOrderResult(intervention, { caseData, caseFlow, teachMeMode });
  const label = neutralStackOrderName(intervention?.label || 'Order');
  return {
    caseNum: caseData?.ccsNumber || caseData?.id,
    caseTitle: caseData?.title || 'Case',
    diagnosis: caseData?.diagnosis || '',
    orderLabel: label,
    kindLabel: result?.kindLabel || 'Result',
    resultText: result?.text || 'No result documented.',
    portraitSrc: portraitSrc || '',
    printedAt: new Date().toLocaleString(),
  };
}

export function formatOrderResultPrintHtml(payload) {
  const p = payload || {};
  const portraitBlock = p.portraitSrc
    ? `<img class="or-print-portrait" src="${esc(p.portraitSrc)}" alt="Patient" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(p.orderLabel)} — Case ${esc(p.caseNum)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 28px 32px;
      font-family: "Segoe UI", Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      background: #fff;
    }
    .or-print-header {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .or-print-portrait {
      width: 200px;
      max-height: 112px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #ccc;
    }
    .or-print-meta h1 {
      margin: 0 0 6px;
      font-size: 16pt;
      font-weight: 700;
    }
    .or-print-meta .sub {
      margin: 0;
      color: #444;
      font-size: 10pt;
    }
    .or-print-kind {
      display: inline-block;
      margin-bottom: 8px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a6d1d;
    }
    .or-print-order {
      margin: 0 0 12px;
      font-size: 13pt;
      font-weight: 700;
    }
    .or-print-body {
      margin: 0;
      padding: 14px 16px;
      background: #f6f7f9;
      border: 1px solid #ddd;
      border-radius: 8px;
      white-space: pre-wrap;
    }
    .or-print-foot {
      margin-top: 20px;
      font-size: 8pt;
      color: #666;
    }
    @media print {
      body { padding: 12mm 14mm; }
      .or-print-hint { display: none; }
    }
  </style>
</head>
<body>
  <p class="or-print-hint" style="font-size:9pt;color:#555;margin:0 0 12px;">
    In the print dialog, choose <strong>Microsoft Print to PDF</strong> as the printer, then Save.
  </p>
  <header class="or-print-header">
    ${portraitBlock}
    <div class="or-print-meta">
      <h1>Case ${esc(p.caseNum)} — ${esc(p.caseTitle)}</h1>
      ${p.diagnosis ? `<p class="sub">Diagnosis: ${esc(p.diagnosis)}</p>` : ''}
      <p class="sub">Immersa · order result</p>
    </div>
  </header>
  <span class="or-print-kind">${esc(p.kindLabel)}</span>
  <h2 class="or-print-order">${esc(p.orderLabel)}</h2>
  <p class="or-print-body">${esc(p.resultText)}</p>
  <p class="or-print-foot">Printed ${esc(p.printedAt)}</p>
</body>
</html>`;
}

/** Opens print dialog — pick Microsoft Print to PDF on Windows. */
export function printOrderResultReport(payload) {
  const html = formatOrderResultPrintHtml(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=760,height=860');
  if (!win) return false;

  const runPrint = () => {
    try {
      win.focus();
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch {
      /* user may close */
    }
  };
  // Blob URL avoids blank about:blank tabs in some Edge popup states.
  win.addEventListener('load', () => setTimeout(runPrint, 180), { once: true });
  setTimeout(runPrint, 900);
  return true;
}
