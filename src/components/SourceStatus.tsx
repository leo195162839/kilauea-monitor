import { useNow } from '../lib/hooks';
import { formatAgo, formatHst } from '../lib/time';

interface Props {
  /** e.g. "Updated", "Image from", "Checked" */
  label: string;
  at: Date | undefined;
  error?: Error;
  onRetry?: () => void;
}

/** One line saying how old a panel's data is, plus an error notice when the last fetch failed. */
export function SourceStatus({ label, at, error, onRetry }: Props) {
  const now = useNow();
  return (
    <div className="source-status">
      {at && (
        <span>
          {label} <time dateTime={at.toISOString()} title={formatHst(at)}>{formatAgo(at, now)}</time>
        </span>
      )}
      {error && (
        <span className="source-error" role="status">
          Couldn’t reach USGS{at ? ', showing the last data received' : ''}.
          {onRetry && (
            <button type="button" className="link-button" onClick={onRetry}>
              Retry
            </button>
          )}
        </span>
      )}
    </div>
  );
}
