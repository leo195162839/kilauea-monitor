// USGS Volcano Alert Levels and Aviation Color Codes, summarized from
// https://www.usgs.gov/programs/VHP/volcanic-alert-levels-characterize-conditions-us-volcanoes

export type Severity = 'good' | 'warning' | 'serious' | 'critical' | 'unknown';

interface LevelInfo {
  severity: Severity;
  meaning: string;
}

export const ALERT_LEVELS: Record<string, LevelInfo> = {
  NORMAL: { severity: 'good', meaning: 'Typical background, non-eruptive state.' },
  ADVISORY: {
    severity: 'warning',
    meaning: 'Elevated unrest above background, or activity has dropped significantly but is still closely monitored.',
  },
  WATCH: {
    severity: 'serious',
    meaning: 'Heightened unrest with increased potential of eruption, or an eruption with limited hazards is underway.',
  },
  WARNING: { severity: 'critical', meaning: 'Hazardous eruption is imminent, underway, or suspected.' },
};

export const COLOR_CODES: Record<string, LevelInfo> = {
  GREEN: { severity: 'good', meaning: 'Non-eruptive background state.' },
  YELLOW: {
    severity: 'warning',
    meaning: 'Elevated unrest above background, or activity has dropped significantly.',
  },
  ORANGE: { severity: 'serious', meaning: 'Heightened unrest, or an eruption with little or no ash emission.' },
  RED: { severity: 'critical', meaning: 'Eruption with significant ash emission is imminent or underway.' },
};

export function levelInfo(table: Record<string, LevelInfo>, value: string): LevelInfo {
  return table[value.toUpperCase()] ?? { severity: 'unknown', meaning: '' };
}
