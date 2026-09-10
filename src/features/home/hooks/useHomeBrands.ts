import { useEffect, useMemo, useState } from 'react';
import type { PosterPalette } from '@shared/components/ProjectPoster';

/**
 * Brand palettes by id for the poster placeholders (W6). Home never imports
 * asset-library — the shared library IPC is the one crossing point, the same
 * way the Studio browser and the agents picker read brands. Fetched once per
 * mount; a store read, nothing more.
 */
export function useHomeBrands(): Map<string, PosterPalette> {
  const [palettes, setPalettes] = useState<[string, PosterPalette][]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.api.libraryBrandsGet().then((res) => {
      if (cancelled || !res.success || !res.brands) return;
      setPalettes(
        res.brands.map((b) => [
          b.id,
          { primary: b.palette.primary, secondary: b.palette.secondary, accent: b.palette.accent },
        ]),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => new Map(palettes), [palettes]);
}
