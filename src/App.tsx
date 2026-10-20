import { useState } from 'react';
import { AlertsPanel } from './components/AlertsPanel';
import { LatestUpdate } from './components/LatestUpdate';
import { QuakePanel } from './components/QuakePanel';
import { RangeFilter } from './components/RangeFilter';
import { StatusSummary } from './components/StatusSummary';
import { TiltPanel } from './components/TiltPanel';
import { Webcams } from './components/Webcams';
import { POLL_MS, type RangeKey } from './config';
import { usePolling } from './lib/hooks';
import { alertsAvailable, storedAlertsKey } from './lib/push';
import { newestBasis } from './lib/status';
import { fetchAviationNotices, fetchLatestUpdate } from './sources/hans';

export function App() {
  const update = usePolling(fetchLatestUpdate, POLL_MS.notices);
  const notices = usePolling((signal) => fetchAviationNotices(signal), POLL_MS.notices);
  const [range, setRange] = useState<RangeKey>('2d');
  // Alerts are private: the card appears only on devices that have the alerts key.
  const [alertsOpen, setAlertsOpen] = useState(() => alertsAvailable() && storedAlertsKey() !== null);

  const retryNotices = () => {
    update.refresh();
    notices.refresh();
  };

  return (
    <div className="app">
      <header className="site-header">
        <h1>Kīlauea Monitor</h1>
        <p>
          Unofficial dashboard of USGS Hawaiian Volcano Observatory data. It refreshes every few minutes while this
          tab is open.
        </p>
      </header>

      <main>
        <StatusSummary
          basis={newestBasis(update.data, notices.data)}
          error={update.error ?? notices.error}
          onRetry={retryNotices}
        />

        {alertsOpen && <AlertsPanel onClose={() => setAlertsOpen(false)} />}

        <LatestUpdate
          update={update.data}
          notices={notices.data}
          checkedAt={update.checkedAt}
          error={update.error ?? notices.error}
          onRetry={retryNotices}
        />

        <Webcams />

        <section aria-labelledby="activity-title">
          <div className="section-head">
            <h2 id="activity-title">Summit activity</h2>
          </div>
          <RangeFilter value={range} onChange={setRange} />
          <div className="activity-grid">
            <TiltPanel range={range} />
            <QuakePanel range={range} />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          <strong>This is not an official warning system.</strong> For hazards, closures and evacuations, follow USGS
          HVO, Hawaiʻi County Civil Defense, and Hawaiʻi Volcanoes National Park.
        </p>
        <ul className="footer-links">
          <li>
            <a href="https://www.usgs.gov/volcanoes/kilauea" target="_blank" rel="noopener noreferrer">
              USGS Kīlauea
            </a>
          </li>
          <li>
            <a href="https://www.hawaiicounty.gov/departments/civil-defense" target="_blank" rel="noopener noreferrer">
              Hawaiʻi County Civil Defense
            </a>
          </li>
          <li>
            <a href="https://www.nps.gov/havo/index.htm" target="_blank" rel="noopener noreferrer">
              Hawaiʻi Volcanoes National Park
            </a>
          </li>
          {alertsAvailable() && !alertsOpen && (
            <li>
              <button type="button" className="link-button footer-button" onClick={() => setAlertsOpen(true)}>
                Private alerts
              </button>
            </li>
          )}
        </ul>
        <p className="footer-sources">
          Data: USGS Hawaiian Volcano Observatory and USGS Earthquake Hazards Program. Basemap: USGS The National Map.
        </p>
      </footer>
    </div>
  );
}
