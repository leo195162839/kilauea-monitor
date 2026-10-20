// USGS Hazard Notification System (HANS): alert levels and HVO notices.
// https://volcanoes.usgs.gov/vsc/api/hansApi
import { KILAUEA } from '../config';

const API = 'https://volcanoes.usgs.gov/vsc/api/hansApi';

export interface LatestUpdate {
  id: string;
  type: string;
  sentAt: Date;
  alertLevel: string;
  colorCode: string;
  synopsis: string;
  /** Full notice as HTML from USGS. Sanitize before rendering. */
  html: string;
}

export interface AviationNotice {
  id: string;
  issuedAt: Date;
  alertLevel: string;
  colorCode: string;
  synopsis: string;
  url: string;
}

type Json = Record<string, unknown>;

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`USGS returned HTTP ${res.status}`);
  return res.json();
}

const str = (o: Json, key: string): string => (typeof o[key] === 'string' ? (o[key] as string) : '');

/** The most recent HVO notice for Kīlauea, or null if HVO has none (e.g. when the volcano is not elevated). */
export async function fetchLatestUpdate(signal: AbortSignal): Promise<LatestUpdate | null> {
  const body = await getJson(`${API}/volcNewest/${KILAUEA.vnum}`, signal);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Json;
  const id = str(o, 'noticeSectionId');
  if (!id) return null;
  return {
    id,
    type: str(o, 'noticeType'),
    // sentUtc looks like "2026-10-19 19:46:23" (UTC, no zone marker).
    sentAt: new Date(`${str(o, 'sentUtc').replace(' ', 'T')}Z`),
    alertLevel: str(o, 'alertLevel'),
    colorCode: str(o, 'colorCode'),
    // Drop the "HVO Kilauea YELLOW/ADVISORY - " prefix; the levels are shown separately.
    synopsis: str(o, 'noticeSynopsis').replace(/^HVO .*? - /, ''),
    html: str(o, 'sectionHtml'),
  };
}

/** Kīlauea aviation notices (VONAs) from the past `days`, newest first. HVO issues these at episode onset, peak and end. */
export async function fetchAviationNotices(signal: AbortSignal, days = 30): Promise<AviationNotice[]> {
  const body = await getJson(`${API}/vonas/${days}?obs=hvo`, signal);
  if (!Array.isArray(body)) return [];
  return (body as Json[])
    .filter((o) => str(o, 'vnum') === KILAUEA.vnum)
    .map((o) => ({
      id: str(o, 'noticeId'),
      issuedAt: issueTime(o),
      alertLevel: str(o, 'alertLevel'),
      colorCode: str(o, 'colorCode'),
      synopsis: str(o, 'noticeSynopsis'),
      url: str(o, 'noticeUrl'),
    }))
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}

// sentUtc on VONAs is only a date, and the timestamp in noticeId is when the
// notice was drafted (sometimes hours early). The VONA's own "DTG: 20261017/1959Z"
// line is the issue time.
function issueTime(o: Json): Date {
  const dtg = str(o, 'noticeHtml').match(/DTG:\s*(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z/);
  if (dtg) {
    const [, y, mo, d, h, mi] = dtg;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:00Z`);
  }
  const fromId = str(o, 'noticeId').match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  return new Date(fromId ? fromId[0] : `${str(o, 'sentUtc')}T00:00:00Z`);
}
