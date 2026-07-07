import { useCallback, useEffect, useState } from 'react';
import type { UserSvgAsset } from '@shared/types/whiteboard';
import { parseSvgFile } from '../services/svg-parser';
import {
  deriveNameFromFile,
  deleteUserSvg,
  fetchUserSvgs,
  generateUserSvgId,
  saveUserSvg,
} from '../services/user-svgs-service';

interface VectorizedInput {
  paths: string[];
  viewBox: string;
  name: string;
  /** Originating raster row id; survives that image being deleted. */
  sourceImageId?: string;
}

interface UseUserSvgs {
  userSvgs: UserSvgAsset[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFromFile: (file: File) => Promise<UserSvgAsset>;
  /** Persist a Phase 12 vectorized result into the My SVGs library. */
  addFromVectorize: (input: VectorizedInput) => Promise<UserSvgAsset>;
  remove: (id: string) => Promise<void>;
}

export function useUserSvgs(): UseUserSvgs {
  const [userSvgs, setUserSvgs] = useState<UserSvgAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchUserSvgs();
      setUserSvgs(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user SVGs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFromFile = useCallback(async (file: File): Promise<UserSvgAsset> => {
    const { paths, viewBox } = await parseSvgFile(file);
    if (paths.length === 0) {
      throw new Error('SVG contains no drawable paths');
    }
    const asset: UserSvgAsset = {
      id: generateUserSvgId(),
      name: deriveNameFromFile(file),
      paths,
      viewBox,
      revealMode: 'draw',
      category: 'objects',
      source: 'upload',
      createdAt: Date.now(),
    };
    await saveUserSvg(asset);
    await refresh();
    return asset;
  }, [refresh]);

  const addFromVectorize = useCallback(
    async (input: VectorizedInput): Promise<UserSvgAsset> => {
      if (input.paths.length === 0) {
        throw new Error('Vectorize produced no paths');
      }
      const asset: UserSvgAsset = {
        id: generateUserSvgId(),
        name: input.name,
        paths: input.paths,
        viewBox: input.viewBox,
        revealMode: 'draw',
        category: 'objects',
        source: 'vectorized',
        createdAt: Date.now(),
        ...(input.sourceImageId ? { sourceImageId: input.sourceImageId } : {}),
      };
      await saveUserSvg(asset);
      await refresh();
      return asset;
    },
    [refresh]
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteUserSvg(id);
    setUserSvgs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { userSvgs, loading, error, refresh, addFromFile, addFromVectorize, remove };
}
