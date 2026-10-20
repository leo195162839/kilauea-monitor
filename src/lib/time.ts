const hstFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Pacific/Honolulu',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatHst(date: Date, withZone = true): string {
  const text = hstFormat.format(date);
  return withZone ? `${text} HST` : text;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatAgo(date: Date, now: number): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}
