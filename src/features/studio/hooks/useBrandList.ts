import { useEffect, useState } from 'react';
import type { StudioBrandPalette } from '@shared/types/asset-library';

export interface BrandOption {
  id: string;
  name: string;
  /** Colors + fonts — what caption templates paint with (D13). The shot
   *  pipeline injects the brand in main, so only captions read these here. */
  palette: StudioBrandPalette;
  fonts: { display: string; body?: string };
}

/** Fired after the editor itself changes the library (Save to library). */
const BRANDS_CHANGED_EVENT = 'vidtsx:studio-brands-changed';

export function notifyBrandsChanged(): void {
  window.dispatchEvent(new CustomEvent(BRANDS_CHANGED_EVENT));
}

/**
 * Read-only brand list for the per-project brand picker (D11). The studio
 * feature never imports asset-library — the shared library IPC surface is
 * the one crossing point. Brand curation happens on the Assets screen, so the
 * list re-reads whenever the Studio screen becomes active again (every
 * visited screen stays mounted — "Create brand…" goes there and back) and
 * after the editor's own "Save to library".
 */
export function useBrandList(): BrandOption[] {
  const [brands, setBrands] = useState<BrandOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await window.api.libraryBrandsGet();
      if (!cancelled && res.success && res.brands) {
        setBrands(res.brands.map(({ id, name, palette, fonts }) => ({ id, name, palette, fonts })));
      }
    };
    const onScreen = (e: Event) => {
      if ((e as CustomEvent<{ screen?: string }>).detail?.screen === 'studio') void load();
    };
    const onChanged = () => void load();
    void load();
    window.addEventListener('vidtsx:screen-active', onScreen);
    window.addEventListener(BRANDS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('vidtsx:screen-active', onScreen);
      window.removeEventListener(BRANDS_CHANGED_EVENT, onChanged);
    };
  }, []);

  return brands;
}
