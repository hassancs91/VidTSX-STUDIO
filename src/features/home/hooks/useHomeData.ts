import { useCallback, useEffect, useState } from 'react';
import type {
  AdsSection,
  GettingStartedSection,
  HomepageData,
  NewsAndTipsSection,
  WhatsNewSection,
} from '../../../shared/ipc/types';

export interface UseHomeDataResult {
  data: HomepageData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  showWhatsNew: boolean;
  showGettingStarted: boolean;
  showNewsAndTips: boolean;
  showAds: boolean;
  hasAnyRightColumn: boolean;
}

function sectionVisible(
  section:
    | WhatsNewSection
    | GettingStartedSection
    | NewsAndTipsSection
    | AdsSection
    | undefined,
  itemsKey: 'entries' | 'guides' | 'items',
): boolean {
  if (!section) return false;
  if (section.enabled === false) return false;
  const items = (section as Record<string, unknown>)[itemsKey];
  if (!Array.isArray(items) || items.length === 0) return false;
  return true;
}

export function useHomeData(): UseHomeDataResult {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.homepageGet();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
        setError(res.error ?? 'Failed to load homepage content');
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load homepage content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showWhatsNew = sectionVisible(data?.whatsNew, 'entries');
  const showGettingStarted = sectionVisible(data?.gettingStarted, 'guides');
  const showNewsAndTips = sectionVisible(data?.newsAndTips, 'items');
  const showAds = sectionVisible(data?.ads, 'items');

  return {
    data,
    loading,
    error,
    reload: load,
    showWhatsNew,
    showGettingStarted,
    showNewsAndTips,
    showAds,
    hasAnyRightColumn: showWhatsNew || showGettingStarted || showAds,
  };
}
