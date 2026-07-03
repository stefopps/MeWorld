/** Render attending-tone chat markdown — headings, lists, tables, **bold**, *italic*. */
export function renderChatMarkdown(text) {
  const src = normalizeChatMarkdown(String(text || '').trim());
  if (!src) return null;

  const blocks = splitMarkdownBlocks(src);
  if (blocks.length === 1 && blocks[0].type === 'paragraph') {
    return <p className="case-chat-md-p">{renderInline(blocks[0].text)}</p>;
  }

  return (
    <div className="case-chat-md">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

/** Same markdown renderer with attending-panel typography (Teach Me / order rationale). */
export function renderAttendingMarkdown(text, { className = '' } = {}) {
  const body = renderChatMarkdown(text);
  if (!body) return null;
  const extra = String(className || '').trim();
  return (
    <div className={`attending-md-block teach-me-text-block selectable-text${extra ? ` ${extra}` : ''}`}>
      {body}
    </div>
  );
}

/** Fix LLM output like `**## Heading**` and inline `text **## Next` before block parse. */
function normalizeChatMarkdown(src) {
  let s = src
    .replace(/\*\*(#{1,4}\s+[^*\n]+)\*\*/g, '$1')
    .replace(/([.!?])\s*(#{1,4}\s+)/g, '$1\n\n$2')
    .replace(/([^\n])\s+(#{1,4}\s+)/g, (match, before, heading) => {
      if (before === '*' || before === '#') return match;
      return `${before}\n\n${heading}`;
    });
  // Break prose from pipe tables so GFM rows are not swallowed into one paragraph.
  s = s.replace(/([^\n|])\n(\|[^\n]+\|)/g, '$1\n\n$2');
  s = s.replace(/(\*\*[^*]+\*\*)\n(\|)/g, '$1\n\n$2');
  // Normalize double-pipe table rows from some LLM outputs: `|| A | B |` → `| A | B |`
  s = s.replace(/^\|\|/gm, '|').replace(/\|\|$/gm, '|');
  s = unfoldInlineGfmTables(s);
  return s;
}

/** Split single-line GFM tables (`prose: | A | B | |---| | C | D |`) into newline rows. */
function unfoldInlineGfmTables(text) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.includes('|')) return line;
      const pipeCount = (trimmed.match(/\|/g) || []).length;
      if (pipeCount < 4) return line;

      const firstPipe = trimmed.indexOf('|');
      const prefix = firstPipe > 0 ? trimmed.slice(0, firstPipe).trimEnd() : '';
      const tablePart = firstPipe >= 0 ? trimmed.slice(firstPipe) : trimmed;

      const rowMatches = tablePart.match(/\|[^|\n]*(?:\|[^|\n]*)+\|/g);
      if (!rowMatches || rowMatches.length < 2) return line;

      const rows = rowMatches.map((r) => r.trim()).join('\n');
      if (!prefix) return rows;
      return `${prefix}\n\n${rows}`;
    })
    .join('\n');
}

function isTableSeparatorLine(trimmed) {
  return /^\|?[\s\-:|]+\|?$/.test(trimmed) && trimmed.replace(/[\s\-:|]/g, '').length === 0;
}

function isTableRowLine(trimmed) {
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  return cells.length >= 2;
}

function collectTableLines(lines, startIndex) {
  const tableLines = [];
  let i = startIndex;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) break;
    if (isTableSeparatorLine(t)) {
      i += 1;
      continue;
    }
    if (!isTableRowLine(t)) break;
    tableLines.push(t);
    i += 1;
  }
  return { tableLines, nextIndex: i };
}

function splitMarkdownBlocks(src) {
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (/^#{1,4}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#+)/)[1].length;
      blocks.push({ type: 'heading', level, text: trimmed.replace(/^#+\s+/, '') });
      i += 1;
      continue;
    }

    if (isTableRowLine(trimmed)) {
      const peek = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (isTableSeparatorLine(peek) || isTableRowLine(peek)) {
        const { tableLines, nextIndex } = collectTableLines(lines, i);
        if (tableLines.length >= 1) {
          blocks.push(parseTable(tableLines));
          i = nextIndex;
          continue;
        }
      }
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const para = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }

  return blocks.length ? blocks : [{ type: 'paragraph', text: src }];
}

function isBlockStart(trimmed) {
  return (
    /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)
    || /^#{1,4}\s+/.test(trimmed)
    || /^[-*•]\s+/.test(trimmed)
    || /^\d+[.)]\s+/.test(trimmed)
    || isTableRowLine(trimmed)
  );
}

function parseTable(tableLines) {
  const rows = tableLines
    .filter((ln) => !isTableSeparatorLine(ln))
    .map((ln) =>
      ln
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    );
  const header = rows[0] || [];
  const body = rows.slice(1);
  return { type: 'table', header, rows: body };
}

function renderBlock(block, key) {
  switch (block.type) {
    case 'hr':
      return <hr key={key} className="case-chat-md-hr" />;
    case 'heading': {
      const Tag = block.level <= 2 ? 'h4' : 'h5';
      return (
        <Tag key={key} className={`case-chat-md-h case-chat-md-h${block.level}`}>
          {renderInline(block.text)}
        </Tag>
      );
    }
    case 'ul':
      return (
        <ul key={key} className="case-chat-md-ul">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="case-chat-md-ol">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div key={key} className="case-chat-md-table-wrap">
          <table className="case-chat-md-table">
            {block.header?.length > 0 && (
              <thead>
                <tr>
                  {block.header.map((cell, j) => (
                    <th key={j}>{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return (
        <p key={key} className="case-chat-md-p">
          {block.text.split('\n').map((ln, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {renderInline(ln)}
            </span>
          ))}
        </p>
      );
  }
}

export function renderInline(chunk, keyPrefix = '') {
  if (!chunk) return null;
  if (!chunk.includes('*') && !chunk.includes('_') && !chunk.includes('`') && !chunk.includes('[')) {
    return chunk;
  }

  const parts = chunk.split(/(\[[^\]]+\]\([^)]+\)|\*\*.+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g);
  const nodes = [];
  let key = 0;

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        const href = m[2];
        const label = m[1];
        if (/\.(webm|mp3|wav|m4a|ogg)(\?|$)/i.test(href) || /\/user-data\//i.test(href)) {
          nodes.push(
            <span key={`${keyPrefix}aud${key++}`} className="case-chat-md-audio-wrap">
              <audio className="case-chat-md-audio" controls preload="metadata" src={href}>
                <a href={href}>{label}</a>
              </audio>
            </span>,
          );
          continue;
        }
        nodes.push(
          <a
            key={`${keyPrefix}a${key++}`}
            className="case-chat-md-link"
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m[1]}
          </a>,
        );
        continue;
      }
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(
        <strong key={`${keyPrefix}b${key++}`} className="case-chat-bold">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      nodes.push(
        <em key={`${keyPrefix}i${key++}`} className="case-chat-italic">
          {part.slice(1, -1)}
        </em>,
      );
    } else if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      nodes.push(
        <em key={`${keyPrefix}i${key++}`} className="case-chat-italic">
          {part.slice(1, -1)}
        </em>,
      );
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code key={`${keyPrefix}c${key++}`} className="case-chat-md-code">
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(part);
    }
  }

  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0];
  return nodes;
}
