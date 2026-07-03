import { useMemo } from 'react';
import { formatYoutubeTimestamp } from '../lib/youtubePlayer.js';
import {
  splitSummarySections,
  tokenizeTimestamps,
} from '../lib/youtubeSummaryRichText.js';
import { renderInline } from '../lib/chatMessageFormat.jsx';

function TimestampLink({ time, seconds, activeSeconds, onSeek }) {
  const isActive = activeSeconds != null && Math.abs(activeSeconds - seconds) < 0.05;
  return (
    <button
      type="button"
      className={`diff-rw-ts-link${isActive ? ' diff-rw-ts-link--active' : ''}`}
      onClick={() => onSeek?.(seconds)}
      title={`Jump to ${formatYoutubeTimestamp(seconds)}`}
    >
      {time}
    </button>
  );
}

function RichParagraph({ text, activeSeconds, onSeek }) {
  const tokens = useMemo(() => tokenizeTimestamps(text), [text]);
  if (!tokens.length) return null;

  return (
    <p className="diff-rw-summary-para">
      {tokens.map((tok, i) =>
        tok.type === 'ts' ? (
          <TimestampLink
            key={`ts-${i}-${tok.seconds}`}
            time={tok.value}
            seconds={tok.seconds}
            activeSeconds={activeSeconds}
            onSeek={onSeek}
          />
        ) : (
          <span key={`t-${i}`}>{renderInline(tok.value)}</span>
        ),
      )}
    </p>
  );
}

export default function RealWorldSummaryRichText({
  summary = '',
  activeSeconds = null,
  onSeek,
}) {
  const { body, highlights } = useMemo(() => splitSummarySections(summary), [summary]);
  const blocks = useMemo(
    () => body.split(/\n+/).map((p) => p.trim()).filter(Boolean),
    [body],
  );

  const isSectionHeading = (line) =>
    line.length <= 52 &&
    !/\d:\d{2}/.test(line) &&
    /^[A-Z]/.test(line) &&
    !line.endsWith('.') &&
    !line.includes(' — ');

  return (
    <div className="diff-rw-summary-rich">
      {blocks.map((block, i) =>
        isSectionHeading(block) ? (
          <h4 key={`h-${i}`} className="diff-rw-summary-heading">
            {renderInline(block)}
          </h4>
        ) : (
          <RichParagraph
            key={`p-${i}`}
            text={block}
            activeSeconds={activeSeconds}
            onSeek={onSeek}
          />
        ),
      )}

      {highlights.length > 0 && (
        <section className="diff-rw-highlights" aria-label="Relatable highlights — click to jump">
          <h4 className="diff-rw-highlights-title">Highlights</h4>
          <ol className="diff-rw-highlights-list">
            {highlights.map((item) => {
              const isActive =
                activeSeconds != null && Math.abs(activeSeconds - item.seconds) < 0.05;
              return (
                <li
                  key={`${item.seconds}-${item.label}`}
                  className={`diff-rw-highlight${isActive ? ' diff-rw-highlight--active' : ''}`}
                >
                  <button
                    type="button"
                    className="diff-rw-highlight-btn"
                    onClick={() => onSeek?.(item.seconds)}
                    title={`Jump to ${formatYoutubeTimestamp(item.seconds)}`}
                  >
                    <span className="diff-rw-transcript-time">{item.time}</span>
                    <span className="diff-rw-highlight-label">{renderInline(item.label)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
