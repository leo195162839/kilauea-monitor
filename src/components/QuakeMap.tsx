import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { KILAUEA, QUAKE_RADIUS_KM } from '../config';
import { formatHst } from '../lib/time';
import type { Quake } from '../sources/quakes';

// Public-domain USGS basemap (imagery with topo labels).
const BASEMAP = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}';

export function quakeRadius(magnitude: number | null): number {
  return 4 + 2 * Math.max(magnitude ?? 0, 0);
}

/** Depth in km to one decimal. Avoids "-0.0" for events at the surface. */
export function formatDepth(km: number): string {
  return `${(Math.round(km * 10) / 10 || 0).toFixed(1)} km`;
}

interface Props {
  quakes: Quake[];
  /** Quakes at or after this time (ms) are drawn in the accent color; older ones in gray. */
  recentSince: number;
}

export function QuakeMap({ quakes, recentSince }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Fractional zoom lets the 25 km circle fill the map instead of snapping out to the whole island.
    const map = L.map(containerRef.current!, { scrollWheelZoom: false, zoomSnap: 0.25 });
    const summit = L.latLng(KILAUEA.lat, KILAUEA.lon);
    map.fitBounds(summit.toBounds(QUAKE_RADIUS_KM * 2000));
    L.tileLayer(BASEMAP, { attribution: 'Basemap: USGS The National Map', maxNativeZoom: 16, maxZoom: 17 }).addTo(map);
    L.circle(summit, {
      radius: QUAKE_RADIUS_KM * 1000,
      className: 'quake-area',
      fill: false,
      interactive: false,
    }).addTo(map);
    L.marker(summit, {
      icon: L.divIcon({ className: 'summit-icon', iconSize: [16, 14] }),
      keyboard: false,
    })
      .bindTooltip('Kīlauea summit')
      .addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // Oldest first, so the most recent quakes are drawn on top.
    const ordered = [...quakes].sort((a, b) => a.time.getTime() - b.time.getTime());
    for (const q of ordered) {
      const radius = quakeRadius(q.magnitude);
      const recent = q.time.getTime() >= recentSince;
      L.circleMarker([q.lat, q.lon], {
        radius,
        className: recent ? 'quake-dot is-recent' : 'quake-dot',
        interactive: false,
      }).addTo(layer);
      // Invisible, larger hit area so small dots are easy to hover.
      L.circleMarker([q.lat, q.lon], { radius: Math.max(radius + 4, 12), stroke: false, fillOpacity: 0 })
        .bindTooltip(quakeTooltip(q), { direction: 'top', offset: [0, -radius] })
        .addTo(layer);
    }
  }, [quakes, recentSince]);

  return <div ref={containerRef} className="quake-map" />;
}

// Built with textContent: place names come from the USGS feed.
function quakeTooltip(q: Quake): HTMLElement {
  const el = document.createElement('div');
  el.className = 'quake-tip';
  const value = document.createElement('strong');
  value.textContent = q.magnitude === null ? 'Magnitude not computed' : `M${q.magnitude.toFixed(1)}`;
  el.append(value);
  for (const text of [formatHst(q.time), `${formatDepth(q.depthKm)} deep`, q.place]) {
    const line = document.createElement('div');
    line.textContent = text;
    el.append(line);
  }
  return el;
}
