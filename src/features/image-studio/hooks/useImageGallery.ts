import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import type { ImageStudioEntry } from '../../../shared/ipc/types';
import type { GalleryImage, GalleryFolder } from '../types';

function toGalleryImage(entry: ImageStudioEntry, basePath: string): GalleryImage {
  // Convert Windows backslashes to forward slashes for file:// URL
  const normalizedBase = basePath.replace(/\\/g, '/');
  return {
    ...entry,
    thumbnailUrl: `file:///${normalizedBase}/${entry.fileName}`,
  };
}

export function useImageGallery() {
  const [allImages, setAllImages] = useState<GalleryImage[]>([]);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [basePath, setBasePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isPending, startLoadTransition] = useTransition();

  const buildGalleryFolders = useCallback(
    (
      rawFolders: { id: string; name: string; createdAt: number }[],
      images: GalleryImage[]
    ): GalleryFolder[] => {
      return rawFolders.map((folder) => {
        const folderImages = images.filter((img) => img.folderId === folder.id);
        return {
          ...folder,
          imageCount: folderImages.length,
          coverThumbnailUrls: folderImages.slice(0, 4).map((img) => img.thumbnailUrl),
        };
      });
    },
    []
  );

  const loadGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.imageStudioList();
      if (result.success) {
        const imgs = result.entries.map((e) => toGalleryImage(e, result.basePath));
        const galleryFolders = buildGalleryFolders(result.folders, imgs);
        startLoadTransition(() => {
          setBasePath(result.basePath);
          setAllImages(imgs);
          setFolders(galleryFolders);
          setLoading(false);
        });
      } else {
        setError(result.error || 'Failed to load gallery');
        setLoading(false);
      }
    } catch {
      setError('Failed to load gallery');
      setLoading(false);
    }
  }, [buildGalleryFolders]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // Re-fetch when a sibling feature (e.g. Flows) writes to the gallery while
  // this screen is mounted but inactive. Without this, new entries/folders
  // only appear after an app restart.
  useEffect(() => {
    const handler = () => {
      loadGallery();
    };
    window.addEventListener('vidtsx:image-studio:refresh', handler);
    return () => window.removeEventListener('vidtsx:image-studio:refresh', handler);
  }, [loadGallery]);

  // Filter images based on active folder
  const images = useMemo(() => {
    if (activeFolderId === null) {
      // Root view: show only unfiled images
      return allImages.filter((img) => !img.folderId);
    }
    return allImages.filter((img) => img.folderId === activeFolderId);
  }, [allImages, activeFolderId]);

  const addEntry = useCallback((entry: ImageStudioEntry) => {
    setAllImages((prev) => {
      const img = toGalleryImage(entry, basePath);
      const updated = [img, ...prev];
      // Update folder counts and covers
      if (entry.folderId) {
        setFolders((prevFolders) =>
          prevFolders.map((f) => {
            if (f.id === entry.folderId) {
              const urls = [img.thumbnailUrl, ...f.coverThumbnailUrls].slice(0, 4);
              return { ...f, imageCount: f.imageCount + 1, coverThumbnailUrls: urls };
            }
            return f;
          })
        );
      }
      return updated;
    });
  }, [basePath]);

  const removeEntry = useCallback(async (id: string) => {
    const result = await window.api.imageStudioDelete({ id });
    if (result.success) {
      setAllImages((prev) => {
        const removed = prev.find((img) => img.id === id);
        const updated = prev.filter((img) => img.id !== id);
        if (removed?.folderId) {
          setFolders((prevFolders) =>
            prevFolders.map((f) => {
              if (f.id === removed.folderId) {
                const folderImgs = updated.filter((img) => img.folderId === f.id);
                return {
                  ...f,
                  imageCount: folderImgs.length,
                  coverThumbnailUrls: folderImgs.slice(0, 4).map((img) => img.thumbnailUrl),
                };
              }
              return f;
            })
          );
        }
        return updated;
      });
    }
    return result.success;
  }, []);

  const removeEntries = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return { deleted: [], failed: [] as string[] };
    const results = await Promise.all(
      ids.map(async (id) => ({ id, ok: (await window.api.imageStudioDelete({ id })).success }))
    );
    const deleted = results.filter((r) => r.ok).map((r) => r.id);
    const failed = results.filter((r) => !r.ok).map((r) => r.id);
    if (deleted.length > 0) {
      const deletedSet = new Set(deleted);
      setAllImages((prev) => {
        const updated = prev.filter((img) => !deletedSet.has(img.id));
        setFolders((prevFolders) =>
          prevFolders.map((f) => {
            const folderImgs = updated.filter((img) => img.folderId === f.id);
            return {
              ...f,
              imageCount: folderImgs.length,
              coverThumbnailUrls: folderImgs.slice(0, 4).map((img) => img.thumbnailUrl),
            };
          })
        );
        return updated;
      });
    }
    return { deleted, failed };
  }, []);

  const saveAs = useCallback(async (id: string) => {
    return window.api.imageStudioSaveAs({ id });
  }, []);

  const copyToClipboard = useCallback(async (id: string) => {
    return window.api.imageStudioCopy({ id });
  }, []);

  // Folder operations

  const createFolder = useCallback(async (name: string) => {
    const result = await window.api.imageStudioFolderCreate({ name });
    if (result.success && result.folder) {
      const galleryFolder: GalleryFolder = {
        ...result.folder,
        imageCount: 0,
        coverThumbnailUrls: [],
      };
      setFolders((prev) => [galleryFolder, ...prev]);
    }
    return result;
  }, []);

  const renameFolderAction = useCallback(async (id: string, name: string) => {
    const result = await window.api.imageStudioFolderRename({ id, name });
    if (result.success) {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f))
      );
    }
    return result;
  }, []);

  const deleteFolderAction = useCallback(async (id: string, deleteImages: boolean) => {
    const result = await window.api.imageStudioFolderDelete({ id, deleteImages });
    if (result.success) {
      if (deleteImages) {
        setAllImages((prev) => prev.filter((img) => img.folderId !== id));
      } else {
        setAllImages((prev) =>
          prev.map((img) => (img.folderId === id ? { ...img, folderId: null } : img))
        );
      }
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (activeFolderId === id) {
        setActiveFolderId(null);
      }
    }
    return result;
  }, [activeFolderId]);

  const moveToFolder = useCallback(async (imageIds: string[], folderId: string | null) => {
    const result = await window.api.imageStudioMoveToFolder({ imageIds, folderId });
    if (result.success) {
      setAllImages((prev) => {
        const updated = prev.map((img) =>
          imageIds.includes(img.id) ? { ...img, folderId } : img
        );
        // Rebuild folder counts
        setFolders((prevFolders) =>
          prevFolders.map((f) => {
            const folderImgs = updated.filter((img) => img.folderId === f.id);
            return {
              ...f,
              imageCount: folderImgs.length,
              coverThumbnailUrls: folderImgs.slice(0, 4).map((img) => img.thumbnailUrl),
            };
          })
        );
        return updated;
      });
    }
    return result;
  }, []);

  return {
    images,
    allImages,
    folders,
    activeFolderId,
    setActiveFolderId,
    loading: loading || isPending,
    error,
    addEntry,
    removeEntry,
    removeEntries,
    saveAs,
    copyToClipboard,
    createFolder,
    renameFolder: renameFolderAction,
    deleteFolder: deleteFolderAction,
    moveToFolder,
    refresh: loadGallery,
  };
}
