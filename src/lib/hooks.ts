import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Polled<T> {
  data: T | undefined;
  error: Error | undefined;
  /** When `data` was last fetched successfully. */
  checkedAt: number | undefined;
  /** False while `data` still belongs to a previous `key` (e.g. the old time range). */
  current: boolean;
  refresh: () => void;
}

interface PollState<T> {
  data?: T;
  dataKey?: string;
  error?: Error;
  checkedAt?: number;
}

/**
 * Calls `load` now and then every `intervalMs` while the tab is visible.
 * A failed fetch keeps the last good data and reports the error alongside it.
 * Changing `key` reloads immediately; until that finishes, the old data stays
 * available with `current: false`.
 */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  key = '',
): Polled<T> {
  const [state, setState] = useState<PollState<T>>({});
  const [manualRuns, setManualRuns] = useState(0);
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let lastRun = 0;

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(run, delay);
    };

    const run = async () => {
      window.clearTimeout(timer);
      controller?.abort();
      const own = new AbortController();
      controller = own;
      lastRun = Date.now();
      try {
        const data = await loadRef.current(own.signal);
        if (own.signal.aborted) return;
        setState({ data, dataKey: key, checkedAt: Date.now() });
      } catch (err) {
        if (own.signal.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, error }));
      }
      schedule(intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        return;
      }
      const elapsed = Date.now() - lastRun;
      if (elapsed >= intervalMs) void run();
      else schedule(intervalMs - elapsed);
    };

    void run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [key, intervalMs, manualRuns]);

  return {
    data: state.data,
    error: state.error,
    checkedAt: state.checkedAt,
    current: state.dataKey === key,
    refresh: () => setManualRuns((n) => n + 1),
  };
}

/** Current time, re-rendering every `intervalMs` so "5 minutes ago" labels stay accurate. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
