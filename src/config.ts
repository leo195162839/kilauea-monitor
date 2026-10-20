export const KILAUEA = {
  vnum: '332010',
  lat: 19.421,
  lon: -155.287,
};

export const QUAKE_RADIUS_KM = 25;

// How often each source is re-checked while the tab is visible.
export const POLL_MS = {
  notices: 2 * 60_000,
  webcams: 2 * 60_000,
  tilt: 5 * 60_000,
  quakes: 5 * 60_000,
};

export type RangeKey = '2d' | '7d';

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '2d', label: 'Past 2 days', days: 2 },
  { key: '7d', label: 'Past week', days: 7 },
];

export const TILT_PLOTS: Record<RangeKey, string> = {
  '2d': 'https://volcanoes.usgs.gov/vsc/captures/kilauea/UWD-TILT-2day.png',
  '7d': 'https://volcanoes.usgs.gov/vsc/captures/kilauea/UWD-TILT-week.png',
};

export interface Webcam {
  code: string;
  title: string;
  url: string;
}

// The HVO webcam metadata API currently returns an empty list, so the cameras
// are listed here. Some live under /observatories/hvo/cams, others under /cams.
const cam = (code: string, dir: string, title: string): Webcam => ({
  code,
  title,
  url: `https://volcanoes.usgs.gov/${dir}/${code}/images/M.jpg`,
});

export const WEBCAMS: Webcam[] = [
  cam('V1cam', 'observatories/hvo/cams', 'West Halemaʻumaʻu crater'),
  cam('V2cam', 'cams', 'East Halemaʻumaʻu crater'),
  cam('V3cam', 'cams', 'South Halemaʻumaʻu crater'),
  cam('F1cam', 'observatories/hvo/cams', 'Thermal view from the west rim'),
  cam('B1cam', 'observatories/hvo/cams', 'Down-dropped block and Halemaʻumaʻu'),
  cam('KWcam', 'observatories/hvo/cams', 'Halemaʻumaʻu and Kaluapele from the west rim'),
  cam('K2cam', 'observatories/hvo/cams', 'Kaluapele from Uēkahuna bluff'),
  cam('KPcam', 'cams', 'Summit from Mauna Loa Strip Road'),
];
