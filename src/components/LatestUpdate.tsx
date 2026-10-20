import { useMemo } from 'react';
import { useNow } from '../lib/hooks';
import { levelInfo, COLOR_CODES } from '../lib/levels';
import { sanitizeNoticeHtml } from '../lib/sanitize';
import { formatAgo, formatHst } from '../lib/time';
import type { AviationNotice, LatestUpdate as Update } from '../sources/hans';
import { SourceStatus } from './SourceStatus';

interface Props {
  update: Update | null | undefined;
  notices: AviationNotice[] | undefined;
  checkedAt: number | undefined;
  error: Error | undefined;
  onRetry: () => void;
}

export function LatestUpdate({ update, notices, checkedAt, error, onRetry }: Props) {
  const now = useNow();
  const html = useMemo(() => (update ? sanitizeNoticeHtml(update.html) : ''), [update]);

  return (
    <section className="card update" aria-labelledby="update-title">
      <div className="card-head">
        <h2 id="update-title">Latest from HVO</h2>
        <a href="https://www.usgs.gov/volcanoes/kilauea/volcano-updates" target="_blank" rel="noopener noreferrer">
          All Kīlauea updates
        </a>
      </div>

      {update === undefined && !error && <p className="placeholder-text">Loading…</p>}
      {update === null && <p>HVO has no recent notice for Kīlauea.</p>}
      {update && (
        <>
          <p className="update-meta">
            {update.type} · {formatHst(update.sentAt)} · {formatAgo(update.sentAt, now)}
          </p>
          <p className="update-synopsis">{update.synopsis}</p>
          {html && (
            <details className="notice-details">
              <summary>Read the full update</summary>
              <div className="notice-html" dangerouslySetInnerHTML={{ __html: html }} />
            </details>
          )}
        </>
      )}

      {notices && notices.length > 0 && (
        <div className="vonas">
          <h3>Recent aviation notices</h3>
          <p className="panel-note">HVO issues these when an episode starts, peaks or ends, and when the color code changes.</p>
          <ol>
            {notices.slice(0, 5).map((n) => (
              <li key={n.id}>
                <div className="vona-meta">
                  <a href={n.url} target="_blank" rel="noopener noreferrer">
                    <time dateTime={n.issuedAt.toISOString()}>{formatHst(n.issuedAt)}</time>
                  </a>
                  <span className="chip">
                    <span className={`swatch sev-${levelInfo(COLOR_CODES, n.colorCode).severity}`} aria-hidden="true" />
                    {n.colorCode}
                  </span>
                </div>
                <p>{n.synopsis}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <SourceStatus label="Checked" at={checkedAt ? new Date(checkedAt) : undefined} error={error} onRetry={onRetry} />
    </section>
  );
}
