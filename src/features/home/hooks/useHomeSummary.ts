import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeSummary } from '../types';

/** Focus-driven refreshes are throttled to this — the summary is cheap but
 *  Alt-Tab bursts should not re-read every store each time. */
const FOCUS_REFRESH_MIN_MS = 5_000;

/**
 * The one Home read (HOME_SUMMARY). Loaded on mount, re-read when the screen
 * becomes active again (`vidtsx:screen-active` from App.tsx — every visited
 * screen stays mounted, so "mount" alone happens once per launch), when the
 * Studio editor finishes a close (its poster just landed), and on window
 * focus. Nothing here spawns anything; main reads its stores and answers.
 */
export function useHomeSummary() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await window.api.homeSummary();
      lastRefreshRef.current = Date.now();
      if (res.success) {
        setSummary(res);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to read the Home summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onActive = (e: Event) => {
      const { screen } = (e as CustomEvent<{ screen: string }>).detail;
      if (screen === 'home') void refresh();
    };
    const onChanged = () => void refresh();
    const onFocus = () => {
      if (Date.now() - lastRefreshRef.current > FOCUS_REFRESH_MIN_MS) void refresh();
    };
    window.addEventListener('vidtsx:screen-active', onActive);
    window.addEventListener('vidtsx:studio-projects-changed', onChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('vidtsx:screen-active', onActive);
      window.removeEventListener('vidtsx:studio-projects-changed', onChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { summary, error, refresh };
}
