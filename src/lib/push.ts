// Turning private push alerts on and off for this device.

// Push alerts are sent by the Worker in worker/. The alerts UI stays hidden while `api` is empty.
const ALERTS = {
  // The deployed Worker. VITE_ALERTS_API overrides it for local testing.
  api: (import.meta.env.VITE_ALERTS_API as string | undefined) ?? 'https://kilauea-alerts.liyuancheng0118.workers.dev',
  // Public half of the push key pair (must match VAPID_PUBLIC_KEY in worker/wrangler.jsonc).
  vapidPublicKey: 'BKCxnkz6qID4txUBZwPCC_n99rXqksSqIaqz0vI9U7ijcIAkzCDHDuXx0Xr5YpoJ3ArYXaM_W_VQlRG8odHXdOE',
};

// The alerts key (the Worker's ALERTS_KEY secret) is entered once per device and kept only on that device.
// On iPhone the Home Screen app has its own storage, so the key is entered inside the installed app.
const KEY_STORAGE = 'kilauea-alerts-key';

export type AlertsState =
  | 'needs-key' // no alerts key on this device yet
  | 'unsupported' // browser has no push support
  | 'install-first' // iPhone/iPad Safari tab: push works only from the Home Screen app
  | 'blocked' // notifications denied for this site
  | 'off'
  | 'on';

export class KeyRejectedError extends Error {
  constructor() {
    super('The alerts key wasn’t accepted.');
  }
}

/** False when alerts aren't configured, or in a dev build (no service worker). */
export const alertsAvailable = () => ALERTS.api !== '' && import.meta.env.PROD;

export function storedAlertsKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

function forgetAlertsKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Nothing stored, or storage unavailable.
  }
}

/** Checks the key with the Worker and stores it on this device if accepted. */
export async function saveAlertsKey(input: string): Promise<void> {
  const key = input.trim().toLowerCase().replace(/\s+/g, '');
  const res = await alertsRequest('/key-check', 'POST', key);
  if (res.status === 401) throw new KeyRejectedError();
  if (!res.ok) throw new Error(`Alerts server returned HTTP ${res.status}`);
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    throw new Error('This browser won’t let the page store the key.');
  }
}

const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const hasPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function currentAlertsState(): Promise<AlertsState> {
  if (!hasPush()) return isAppleMobile() && !isInstalled() ? 'install-first' : 'unsupported';
  const key = storedAlertsKey();
  if (!key) return 'needs-key';
  if (Notification.permission === 'denied') return 'blocked';
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return 'off';
  // Re-send in case the server dropped it; storing it again is harmless. If the key was
  // changed on the server, this device has to be set up again.
  try {
    await saveSubscription(subscription, key);
  } catch (err) {
    if (err instanceof KeyRejectedError) {
      forgetAlertsKey();
      await subscription.unsubscribe();
      return 'needs-key';
    }
    // Offline or server trouble: the subscription is still in place.
  }
  return 'on';
}

/** Must be called straight from a click: Safari only shows the permission prompt for a user gesture. */
export async function turnOnAlerts(): Promise<AlertsState> {
  const key = storedAlertsKey();
  if (!key) return 'needs-key';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(ALERTS.vapidPublicKey),
  });
  try {
    await saveSubscription(subscription, key);
  } catch (err) {
    await subscription.unsubscribe();
    if (err instanceof KeyRejectedError) forgetAlertsKey();
    throw err;
  }
  return 'on';
}

export async function turnOffAlerts(): Promise<AlertsState> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const key = storedAlertsKey();
    // The server also drops subscriptions that stop working, so a failed request here is harmless.
    if (key) await alertsRequest('/subscriptions', 'DELETE', key, { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  }
  return 'off';
}

async function saveSubscription(subscription: PushSubscription, key: string): Promise<void> {
  const res = await alertsRequest('/subscriptions', 'POST', key, subscription);
  if (res.status === 401) throw new KeyRejectedError();
  if (!res.ok) throw new Error(`Alerts server returned HTTP ${res.status}`);
}

function alertsRequest(path: string, method: string, key: string, body?: unknown): Promise<Response> {
  return fetch(`${ALERTS.api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
