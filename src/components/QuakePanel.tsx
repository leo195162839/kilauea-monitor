import { useMemo, useState } from 'react';
import { POLL_MS, QUAKE_RADIUS_KM, RANGES, type RangeKey } from '../config';
import { usePolling } from '../lib/hooks';
import { formatHst } from '../lib/time';
import { fetchRecentQuakes, type Quake } from '../sources/quakes';
import { formatDepth, QuakeMap, quakeRadius } from './QuakeMap';
import { SourceStatus } from './SourceStatus';

const TABLE_ROWS = 20;
const LEGEND_MAGNITUDES = [1, 2, 3];

export function QuakePanel({ range }: { range: RangeKey }) {
  const { label, days } = RANGES.find((r) => r.key === range) ?? RANGES[0];
  // One fetch covers the past week; the selected range is a filter on it.
  const { data, error, checkedAt, refresh } = usePolling(fetchRecentQuakes, POLL_MS.quakes);
  const [showAll, setShowAll] = useState(false);

  const quakes = useMemo(() => {
    const since = (checkedAt ?? 0) - days * 86_400_000;
    return (data ?? []).filter((q) => q.time.getTime() >= since);
  }, [data, checkedAt, days]);
  const largest = quakes.reduce<Quake | undefined>(
    (max, q) => (q.magnitude !== null && (max?.magnitude == null || q.magnitude > max.magnitude) ? q : max),
    undefined,
  );
  const recentSince = (checkedAt ?? 0) - 86_400_000;
  const rows = showAll ? quakes : quakes.slice(0, TABLE_ROWS);
  const scope = `within ${QUAKE_RADIUS_KM} km of the summit, ${label.toLowerCase()}`;

  return (
    <>
      <section className="card" aria-labelledby="quakes-title">
        <h3 id="quakes-title">Earthquakes</h3>
        {data ? (
          <p className="quake-stat">
            <span className="stat-value">{quakes.length}</span>
            <span className="stat-label">
              {quakes.length === 1 ? 'earthquake' : 'earthquakes'} {scope}
              {largest?.magnitude != null && `. Largest M${largest.magnitude.toFixed(1)}`}
            </span>
          </p>
        ) : (
          <p className="placeholder-text">{error ? 'Earthquake data unavailable.' : 'Loading…'}</p>
        )}
        <QuakeMap quakes={quakes} recentSince={recentSince} />
        <div className="map-legend" aria-label="Map legend">
          <span className="legend-item">
            <span className="legend-dot is-recent" aria-hidden="true" />
            Past 24 hours
          </span>
          <span className="legend-item">
            <span className="legend-dot" aria-hidden="true" />
            Earlier
          </span>
          <span className="legend-item legend-sizes">
            Size shows magnitude:
            {LEGEND_MAGNITUDES.map((m) => {
              const r = quakeRadius(m);
              return (
                <span key={m} className="legend-size">
                  <svg width={r * 2 + 2} height={r * 2 + 2} aria-hidden="true">
                    <circle cx={r + 1} cy={r + 1} r={r} />
                  </svg>
                  M{m}
                </span>
              );
            })}
          </span>
        </div>
        <SourceStatus label="Checked" at={checkedAt ? new Date(checkedAt) : undefined} error={error} onRetry={refresh} />
      </section>

      <section className="card span-all" aria-labelledby="quake-list-title">
        <h3 id="quake-list-title">Earthquake list</h3>
        {quakes.length === 0 ? (
          <p className="placeholder-text">{data ? `No earthquakes ${scope}.` : 'Loading…'}</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="quake-table">
                <caption className="visually-hidden">Earthquakes {scope}, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Time (HST)</th>
                    <th scope="col" className="num">Mag</th>
                    <th scope="col" className="num">Depth</th>
                    <th scope="col">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => (
                    <tr key={q.id}>
                      <td>{formatHst(q.time, false)}</td>
                      <td className="num">{q.magnitude === null ? '–' : q.magnitude.toFixed(1)}</td>
                      <td className="num">{formatDepth(q.depthKm)}</td>
                      <td>
                        <a href={q.url} target="_blank" rel="noopener noreferrer">
                          {q.place || 'USGS event page'}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quakes.length > TABLE_ROWS && (
              <button type="button" className="button" onClick={() => setShowAll((v) => !v)}>
                {showAll ? `Show the ${TABLE_ROWS} most recent` : `Show all ${quakes.length}`}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
