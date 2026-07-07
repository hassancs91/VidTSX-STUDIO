import { useCallback, useEffect, useState } from 'react';
import type { UserImageAsset } from '@shared/types/whiteboard';
import {
  deleteUserImage,
  fetchUserImages,
  fileToBase64,
  readImageDimensions,
  uploadUserImage,
} from '../services/user-images-service';

interface UseUserImages {
  userImages: UserImageAsset[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFromFile: (file: File) => Promise<UserImageAsset>;
  remove: (id: string) => Promise<void>;
}

export function useUserImages(): UseUserImages {
  const [userImages, setUserImages] = useState<UserImageAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchUserImages();
      setUserImages(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFromFile = useCallback(async (file: File): Promise<UserImageAsset> => {
    const dims = await readImageDimensions(file);
    const base64 = await fileToBase64(file);
    const image = await uploadUserImage({
      base64,
      filename: file.name,
      width: dims.width,
      height: dims.height,
    });
    await refresh();
    return image;
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteUserImage(id);
    setUserImages((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { userImages, loading, error, refresh, addFromFile, remove };
}
