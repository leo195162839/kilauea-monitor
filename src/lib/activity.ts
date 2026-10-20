// Reads the eruption state out of HVO's wording. HVO doesn't publish this as a
// field, so it's a best guess from the newest notice, and the UI always shows
// the notice text it was based on. Patterns come from HVO's 2026 notices, e.g.
//   "Precursory low-level eruptive activity before episode 55 ... began ..."
//   "Episode 55 of the ongoing Halemaʻumaʻu eruption began at 3:19 AM HST ..."
//   "Episode 55 ..., which began at 3:19 a.m. ..., continues at 5:00 a.m. HST."
//   "Episode 55 of the ongoing Halemaʻumaʻu eruption ended abruptly at 9:03 a.m. ..."
//   "... is currently paused, current forecast for episode 51 fountaining onset is July 14-16."
//   "Strong glow and minor intermittent spattering continue from the north ... vents"

export type ActivityState = 'fountaining' | 'precursory' | 'low-level' | 'paused' | 'unknown';

export interface Activity {
  state: ActivityState;
  detail: string | undefined;
}

export const ACTIVITY_LABEL: Record<ActivityState, string> = {
  fountaining: 'Lava fountaining',
  precursory: 'Precursory activity',
  'low-level': 'Low-level activity',
  paused: 'Eruption paused',
  unknown: 'See latest update',
};

const episodeIn = (text: string, pattern: RegExp): number | undefined => {
  const m = text.match(pattern);
  return m ? Number(m[1]) : undefined;
};

export function describeActivity(text: string): Activity {
  const episode = episodeIn(text, /\bepisode\s+(\d+)/i);

  if (/\b(ended|paused)\b/i.test(text)) {
    const ended = episodeIn(text, /\bepisode\s+(\d+)[^.]*\bended\b/i);
    const next = episodeIn(text, /\bforecast for episode\s+(\d+)/i);
    const detail =
      ended !== undefined ? `Episode ${ended} ended`
      : next !== undefined ? `Next: episode ${next}`
      : undefined;
    return { state: 'paused', detail };
  }
  if (/\bprecursory\b/i.test(text)) {
    return { state: 'precursory', detail: episode !== undefined ? `Ahead of episode ${episode}` : undefined };
  }
  if (episode !== undefined && /\b(began|begun|continues|continuing|underway)\b/i.test(text)) {
    return { state: 'fountaining', detail: `Episode ${episode} in progress` };
  }
  if (/\b(overflows?|spatter\w*|lava flows?|erupting)\b/i.test(text)) {
    return { state: 'low-level', detail: undefined };
  }
  return { state: 'unknown', detail: undefined };
}
