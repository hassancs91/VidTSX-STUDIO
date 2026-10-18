import { useEffect, useState } from 'react';
import type { CraftPackInfo } from '@shared/studio/craft-pack';

/** The built-in craft packs, loaded once; [] until they arrive (the pickers then offer only None). */
export function useCraftPacks(): CraftPackInfo[] {
  const [packs, setPacks] = useState<CraftPackInfo[]>([]);
  useEffect(() => {
    let disposed = false;
    window.api.tsxCraftPacks()
      .then((res) => {
        if (!disposed) setPacks(res.packs);
      })
      .catch(() => {});
    return () => { disposed = true; };
  }, []);
  return packs;
}
