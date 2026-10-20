import { ACTIVITY_LABEL, describeActivity } from '../lib/activity';
import { useNow } from '../lib/hooks';
import { ALERT_LEVELS, COLOR_CODES, levelInfo, type Severity } from '../lib/levels';
import { formatAgo, formatHst } from '../lib/time';

/** The newest HVO notice (daily update or aviation notice) that the status is read from. */
export interface StatusBasis {
  text: string;
  at: Date;
  source: string;
  alertLevel: string;
  colorCode: string;
}

interface Props {
  basis: StatusBasis | undefined;
  error: Error | undefined;
  onRetry: () => void;
}

export function StatusSummary({ basis, error, onRetry }: Props) {
  const now = useNow();

  if (!basis) {
    return (
      <section className="status-grid" aria-label="Current status">
        <div className="card hero">
          {error ? (
            <p>
              Couldn’t load HVO status.{' '}
              <button type="button" className="link-button" onClick={onRetry}>
                Retry
              </button>
            </p>
          ) : (
            <p className="placeholder-text">Loading HVO status…</p>
          )}
        </div>
      </section>
    );
  }

  const activity = describeActivity(basis.text);
  return (
    <section className="status-grid" aria-label="Current status">
      <div className="card hero">
        <p className="tile-label">Eruption status</p>
        <p className="hero-value">{ACTIVITY_LABEL[activity.state]}</p>
        {activity.detail && <p className="hero-detail">{activity.detail}</p>}
        <p className="tile-meaning">Read from the wording of HVO’s latest notice, shown below.</p>
      </div>
      <LevelTile label="Volcano alert level" value={basis.alertLevel} {...levelInfo(ALERT_LEVELS, basis.alertLevel)} />
      <LevelTile label="Aviation color code" value={basis.colorCode} {...levelInfo(COLOR_CODES, basis.colorCode)} />
      <div className="card tile">
        <p className="tile-label">Latest HVO notice</p>
        <p className="tile-value">{formatAgo(basis.at, now)}</p>
        <p className="tile-meaning">
          {basis.source}
          <br />
          {formatHst(basis.at)}
        </p>
      </div>
    </section>
  );
}

function LevelTile({ label, value, severity, meaning }: { label: string; value: string; severity: Severity; meaning: string }) {
  return (
    <div className="card tile">
      <p className="tile-label">{label}</p>
      <p className="tile-value">
        <span className={`swatch sev-${severity}`} aria-hidden="true" />
        {value || 'Unknown'}
      </p>
      {meaning && <p className="tile-meaning">{meaning}</p>}
    </div>
  );
}
