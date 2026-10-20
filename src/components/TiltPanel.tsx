import { POLL_MS, RANGES, TILT_PLOTS, type RangeKey } from '../config';
import { usePolling } from '../lib/hooks';
import { loadImage } from '../sources/images';
import { SourceStatus } from './SourceStatus';

// HVO publishes tilt only as a rendered plot; there is no machine-readable feed.
export function TiltPanel({ range }: { range: RangeKey }) {
  const url = TILT_PLOTS[range];
  const { data, error, current, refresh } = usePolling((signal) => loadImage(url, signal), POLL_MS.tilt, url);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label.toLowerCase();

  return (
    <section className="card" aria-labelledby="tilt-title">
      <h3 id="tilt-title">Summit tilt</h3>
      <p className="panel-note">
        Electronic tiltmeter at Uēkahuna (UWD), plotted by HVO. The blue line rises as the summit inflates between
        episodes and drops sharply while lava fountains.
      </p>
      <div className={`plot-frame${current ? '' : ' is-refreshing'}`}>
        {data ? (
          <img src={data.objectUrl} alt={`HVO plot of summit tilt at station UWD, ${rangeLabel}`} />
        ) : (
          <span className="placeholder-text">{error ? 'Plot unavailable' : 'Loading…'}</span>
        )}
      </div>
      <SourceStatus label="Plot updated" at={data?.lastModified} error={error} onRetry={refresh} />
    </section>
  );
}
