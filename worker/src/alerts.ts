// Decides when a status change is worth a push notification.
import { ACTIVITY_LABEL, describeActivity, type ActivityState } from '../../src/lib/activity';
import type { StatusBasis } from '../../src/lib/status';

/** What the Worker remembers between runs. */
export type Snapshot = {
  state: ActivityState;
  detail: string | null;
  alertLevel: string;
  colorCode: string;
  text: string;
  /** Time of the HVO notice the snapshot was read from (ISO). */
  at: string;
};

export type Alert = {
  title: string;
  body: string;
};

// Default triggers: the eruption moves into one of these states, or the alert level or
// aviation color code changes.
const ALERT_STATES: ActivityState[] = ['precursory', 'fountaining', 'paused'];
const MAX_BODY = 220;

export function snapshotOf(basis: StatusBasis, previous: Snapshot | null): Snapshot {
  const activity = describeActivity(basis.text);
  // Wording the rules don't recognize keeps the last known state, so it neither
  // sends an alert itself nor hides the next real change.
  const keepPrevious = activity.state === 'unknown' && previous !== null;
  return {
    state: keepPrevious ? previous.state : activity.state,
    detail: keepPrevious ? previous.detail : (activity.detail ?? null),
    alertLevel: basis.alertLevel.toUpperCase() || previous?.alertLevel || '',
    colorCode: basis.colorCode.toUpperCase() || previous?.colorCode || '',
    text: basis.text,
    at: basis.at.toISOString(),
  };
}

/** The alert to send for this change, or null. The first run only records a baseline. */
export function alertFor(previous: Snapshot | null, current: Snapshot): Alert | null {
  if (!previous) return null;
  const stateChanged = current.state !== previous.state && ALERT_STATES.includes(current.state);
  const levelChanged = current.alertLevel !== previous.alertLevel || current.colorCode !== previous.colorCode;
  if (!stateChanged && !levelChanged) return null;

  const title = stateChanged
    ? `Kīlauea: ${ACTIVITY_LABEL[current.state]}${current.detail ? ` · ${current.detail}` : ''}`
    : `Kīlauea: ${current.alertLevel} / ${current.colorCode}`;
  const levels = levelChanged
    ? `Alert level ${previous.alertLevel} → ${current.alertLevel}, color code ${previous.colorCode} → ${current.colorCode}. `
    : '';
  const body = `${levels}${current.text}`;
  return { title, body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body };
}
