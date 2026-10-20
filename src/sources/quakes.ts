// USGS real-time earthquake feed: every magnitude worldwide, past 7 days.
// https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
// The summary feeds are CDN-cached and refresh every minute, and USGS recommends
// them over the query service for apps that poll. (The query service took ~20 s
// per uncached request when this was written.) The feed is filtered to the
// summit area here.
import { KILAUEA, QUAKE_RADIUS_KM } from '../config';

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';

export interface Quake {
  id: string;
  time: Date;
  magnitude: number | null;
  depthKm: number;
  lat: number;
  lon: number;
  place: string;
  url: string;
}

interface Feature {
  id: string;
  properties: { mag: number | null; time: number; place: string | null; url: string; type: string };
  geometry: { coordinates: [number, number, number] };
}

/** Earthquakes within QUAKE_RADIUS_KM of the summit over the past 7 days, newest first. */
export async function fetchRecentQuakes(signal: AbortSignal): Promise<Quake[]> {
  const res = await fetch(FEED, { signal });
  if (!res.ok) throw new Error(`USGS returned HTTP ${res.status}`);
  const body = (await res.json()) as { features?: Feature[] };
  return (body.features ?? [])
    .filter((f) => f.properties.type === 'earthquake')
    .map((f) => ({
      id: f.id,
      time: new Date(f.properties.time),
      magnitude: f.properties.mag,
      depthKm: f.geometry.coordinates[2],
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      place: f.properties.place ?? '',
      url: f.properties.url,
    }))
    .filter((q) => distanceKm(KILAUEA.lat, KILAUEA.lon, q.lat, q.lon) <= QUAKE_RADIUS_KM)
    .sort((a, b) => b.time.getTime() - a.time.getTime());
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
