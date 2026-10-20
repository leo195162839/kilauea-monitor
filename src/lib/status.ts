// Shared by the dashboard and the alerts Worker, so both read the status the same way.
import type { AviationNotice, LatestUpdate } from '../sources/hans';

/** The newest HVO notice (daily update or aviation notice) that the status is read from. */
export interface StatusBasis {
  text: string;
  at: Date;
  source: string;
  alertLevel: string;
  colorCode: string;
}

// The status comes from whichever is newer: the latest HVO notice of any kind, or
// the latest aviation notice (issued at episode onset, peak and end).
export function newestBasis(
  update: LatestUpdate | null | undefined,
  notices: AviationNotice[] | undefined,
): StatusBasis | undefined {
  const candidates: StatusBasis[] = [];
  if (update) {
    candidates.push({
      text: update.synopsis,
      at: update.sentAt,
      source: update.type || 'HVO notice',
      alertLevel: update.alertLevel,
      colorCode: update.colorCode,
    });
  }
  const vona = notices?.[0];
  if (vona) {
    candidates.push({
      text: vona.synopsis,
      at: vona.issuedAt,
      source: 'Aviation notice (VONA)',
      alertLevel: vona.alertLevel,
      colorCode: vona.colorCode,
    });
  }
  return candidates.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
}
