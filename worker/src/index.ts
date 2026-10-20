// Kīlauea alerts: checks HVO every minute and sends web push notifications to the
// owner's devices. Signing up a device requires the ALERTS_KEY secret.
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';
import { newestBasis } from '../../src/lib/status';
import { fetchAviationNotices, fetchLatestUpdate } from '../../src/sources/hans';
import { alertFor, snapshotOf, type Alert, type Snapshot } from './alerts';

// Only the owner's devices sign up, so this is just a safety cap.
const MAX_SUBSCRIPTIONS = 20;
// Subscriptions must point at a browser push service, so the Worker never posts to arbitrary URLs.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.apple\.com$/, /\.push\.services\.mozilla\.com$/];

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkAndNotify(env));
  },
  async fetch(request, env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;

async function checkAndNotify(env: Env): Promise<void> {
  const signal = AbortSignal.timeout(20_000);
  const [update, notices] = await Promise.all([fetchLatestUpdate(signal), fetchAviationNotices(signal)]);
  const basis = newestBasis(update, notices);
  if (!basis) {
    console.warn('No HVO notice available');
    return;
  }

  const previous = await readState<Snapshot>(env, 'status');
  const current = snapshotOf(basis, previous);
  const alert = alertFor(previous, current);
  // Saved before sending, so a run cut off mid-send (e.g. over the CPU limit) doesn't repeat the alert every minute.
  if (JSON.stringify(previous) !== JSON.stringify(current)) await writeState(env, 'status', current);
  if (alert) await notifyAll(env, alert);
  await writeState(env, 'checked_at', new Date().toISOString());
}

async function notifyAll(env: Env, alert: Alert): Promise<void> {
  const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM subscriptions').all<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>();
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const row of results) {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      const payload = await buildPushPayload({ data: alert, options: { ttl: 6 * 3600, urgency: 'high' } }, subscription, vapid);
      const res = await fetch(row.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        // The browser dropped this subscription (app uninstalled, alerts turned off, etc.).
        await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
        removed++;
      } else if (!res.ok) {
        failed++;
        console.warn('Push rejected', res.status, new URL(row.endpoint).host, (await res.text()).slice(0, 200));
      } else {
        sent++;
      }
    } catch (err) {
      failed++;
      console.warn('Push error', new URL(row.endpoint).host, String(err));
    }
  }
  console.log(`Alert "${alert.title}": sent ${sent}, removed ${removed}, failed ${failed}`);
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin !== null && env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).includes(origin);
  const cors: Record<string, string> = allowedOrigin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        Vary: 'Origin',
      }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (url.pathname === '/status' && request.method === 'GET') {
    return json({ status: await readState<Snapshot>(env, 'status'), checkedAt: await readState<string>(env, 'checked_at') });
  }

  // Alerts are private: everything below needs the ALERTS_KEY secret, entered once on each of the owner's devices.
  if (url.pathname === '/key-check' || url.pathname === '/subscriptions') {
    if (!allowedOrigin) return json({ error: 'Origin not allowed' }, 403);
    if (!(await hasAlertsKey(request, env))) return json({ error: 'Alerts key not accepted' }, 401);
  }

  if (url.pathname === '/key-check' && request.method === 'POST') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (url.pathname === '/subscriptions') {
    const body = await request.json().catch(() => null);

    if (request.method === 'POST') {
      const subscription = parseSubscription(body);
      if (!subscription) return json({ error: 'Not a valid push subscription' }, 400);
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first<number>('n');
      const exists = await env.DB.prepare('SELECT 1 FROM subscriptions WHERE endpoint = ?').bind(subscription.endpoint).first();
      if (!exists && (count ?? 0) >= MAX_SUBSCRIPTIONS) return json({ error: 'Subscription limit reached' }, 503);
      await env.DB.prepare(
        `INSERT INTO subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      )
        .bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, new Date().toISOString())
        .run();
      return json({ ok: true }, 201);
    }

    if (request.method === 'DELETE') {
      const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
      if (typeof endpoint !== 'string') return json({ error: 'Missing endpoint' }, 400);
      await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(endpoint).run();
      return new Response(null, { status: 204, headers: cors });
    }
  }

  return json({ error: 'Not found' }, 404);
}

async function hasAlertsKey(request: Request, env: Env): Promise<boolean> {
  const given = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!given || !env.ALERTS_KEY) return false;
  // Compare hashes so both inputs have the same length, as timingSafeEqual requires.
  const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(given), digest(env.ALERTS_KEY)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function parseSubscription(body: unknown): PushSubscription | null {
  if (!body || typeof body !== 'object') return null;
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return null;
  let host: string;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return null;
    host = parsed.hostname;
  } catch {
    return null;
  }
  if (!PUSH_HOSTS.some((re) => re.test(host))) return null;
  const { p256dh, auth } = keys ?? {};
  // p256dh is a 65-byte P-256 key and auth a 16-byte secret, both base64url.
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{86,88}={0,2}$/.test(p256dh)) return null;
  if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{21,24}={0,2}$/.test(auth)) return null;
  return { endpoint, expirationTime: null, keys: { p256dh, auth } };
}

async function readState<T>(env: Env, key: string): Promise<T | null> {
  const value = await env.DB.prepare('SELECT value FROM state WHERE key = ?').bind(key).first<string>('value');
  return value === null ? null : (JSON.parse(value) as T);
}

async function writeState(env: Env, key: string, value: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, JSON.stringify(value), new Date().toISOString())
    .run();
}
