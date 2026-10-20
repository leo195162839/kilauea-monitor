import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currentAlertsState, saveAlertsKey, turnOffAlerts, turnOnAlerts, type AlertsState } from '../lib/push';

const MESSAGES: Partial<Record<AlertsState, string>> = {
  on: 'Alerts are on for this device.',
  'install-first':
    'On iPhone and iPad, alerts work only in the installed app: tap Share, then Add to Home Screen, and open Kīlauea Monitor from your Home Screen.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser or system settings, then reload.',
  unsupported: 'This browser doesn’t support push notifications.',
};

/** Private alerts for the owner's devices. Shown only once a key is stored, or after "Private alerts" in the footer. */
export function AlertsPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AlertsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    currentAlertsState()
      .then(setState)
      .catch(() => setState('unsupported'));
  }, []);

  useEffect(() => {
    if (state === 'needs-key') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state]);

  if (state === null) return null;

  const run = (action: () => Promise<AlertsState>) => {
    setBusy(true);
    setError(null);
    action()
      .then(setState)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        return currentAlertsState().then(setState);
      })
      .finally(() => setBusy(false));
  };

  const submitKey = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await saveAlertsKey(keyInput);
      setKeyInput('');
      return currentAlertsState();
    });
  };

  return (
    <section ref={ref} className="card alerts" aria-labelledby="alerts-title">
      <div className="alerts-text">
        <h2 id="alerts-title">Private alerts</h2>
        <p className="panel-note">
          Notifications when HVO reports that precursory activity or lava fountaining has started, that the eruption
          has paused, or that the alert level or aviation color code has changed.
        </p>
        {state === 'needs-key' && (
          <form className="key-form" onSubmit={submitKey}>
            <label htmlFor="alerts-key">Alerts key</label>
            <input
              id="alerts-key"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button type="submit" className="button" disabled={busy || keyInput.trim() === ''}>
              Save key
            </button>
            <button type="button" className="link-button" onClick={onClose}>
              Cancel
            </button>
          </form>
        )}
        {MESSAGES[state] && <p className="alerts-state">{MESSAGES[state]}</p>}
        {error && (
          <p className="alerts-state" role="status">
            {error}
          </p>
        )}
      </div>
      {state === 'off' && (
        <button type="button" className="button" disabled={busy} onClick={() => run(turnOnAlerts)}>
          Turn on alerts
        </button>
      )}
      {state === 'on' && (
        <button type="button" className="button" disabled={busy} onClick={() => run(turnOffAlerts)}>
          Turn off
        </button>
      )}
    </section>
  );
}
