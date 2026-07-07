import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import type { VideoStudioEntry } from '../../../shared/ipc/types';
import type { GalleryVideo, GalleryFolder } from '../types';

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function toGalleryVideo(
  entry: VideoStudioEntry,
  basePath: string,
  thumbnailsBasePath: string,
): GalleryVideo {
  const base = normalize(basePath);
  const thumbBase = normalize(thumbnailsBasePath);
  return {
    ...entry,
    videoUrl: `file:///${base}/${entry.fileName}`,
    thumbnailUrl: entry.thumbnailFileName ? `file:///${thumbBase}/${entry.thumbnailFileName}` : null,
  };
}

export function useVideoGallery() {
  const [allVideos, setAllVideos] = useState<GalleryVideo[]>([]);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [basePath, setBasePath] = useState('');
  const [thumbnailsBasePath, setThumbnailsBasePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isPending, startLoadTransition] = useTransition();

  const buildGalleryFolders = useCallback(
    (
      rawFolders: { id: string; name: string; createdAt: number }[],
      videos: GalleryVideo[],
    ): GalleryFolder[] => {
      return rawFolders.map((folder) => {
        const folderVideos = videos.filter((v) => v.folderId === folder.id);
        return {
          ...folder,
          videoCount: folderVideos.length,
          coverThumbnailUrls: folderVideos
            .slice(0, 4)
            .map((v) => v.thumbnailUrl)
            .filter((u): u is string => u !== null),
        };
      });
    },
    [],
  );

  const loadGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.videoStudioList();
      if (result.success) {
        const vids = result.entries.map((e) =>
          toGalleryVideo(e, result.basePath, result.thumbnailsBasePath),
        );
        const galleryFolders = buildGalleryFolders(result.folders, vids);
        startLoadTransition(() => {
          setBasePath(result.basePath);
          setThumbnailsBasePath(result.thumbnailsBasePath);
          setAllVideos(vids);
          setFolders(galleryFolders);
          setLoading(false);
        });
      } else {
        setError(result.error || 'Failed to load videos');
        setLoading(false);
      }
    } catch {
      setError('Failed to load videos');
      setLoading(false);
    }
  }, [buildGalleryFolders]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  useEffect(() => {
    const handler = () => {
      loadGallery();
    };
    window.addEventListener('vidtsx:video-studio:refresh', handler);
    return () => window.removeEventListener('vidtsx:video-studio:refresh', handler);
  }, [loadGallery]);

  const videos = useMemo(() => {
    if (activeFolderId === null) {
      return allVideos.filter((v) => !v.folderId);
    }
    return allVideos.filter((v) => v.folderId === activeFolderId);
  }, [allVideos, activeFolderId]);

  const removeEntry = useCallback(async (id: string) => {
    const result = await window.api.videoStudioDelete({ id });
    if (result.success) {
      setAllVideos((prev) => {
        const removed = prev.find((v) => v.id === id);
        const updated = prev.filter((v) => v.id !== id);
        if (removed?.folderId) {
          setFolders((prevFolders) =>
            prevFolders.map((f) => {
              if (f.id === removed.folderId) {
                const folderVids = updated.filter((v) => v.folderId === f.id);
                return {
                  ...f,
                  videoCount: folderVids.length,
                  coverThumbnailUrls: folderVids
                    .slice(0, 4)
                    .map((v) => v.thumbnailUrl)
                    .filter((u): u is string => u !== null),
                };
              }
              return f;
            }),
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
      ids.map(async (id) => ({ id, ok: (await window.api.videoStudioDelete({ id })).success })),
    );
    const deleted = results.filter((r) => r.ok).map((r) => r.id);
    const failed = results.filter((r) => !r.ok).map((r) => r.id);
    if (deleted.length > 0) {
      const deletedSet = new Set(deleted);
      setAllVideos((prev) => {
        const updated = prev.filter((v) => !deletedSet.has(v.id));
        setFolders((prevFolders) =>
          prevFolders.map((f) => {
            const folderVids = updated.filter((v) => v.folderId === f.id);
            return {
              ...f,
              videoCount: folderVids.length,
              coverThumbnailUrls: folderVids
                .slice(0, 4)
                .map((v) => v.thumbnailUrl)
                .filter((u): u is string => u !== null),
            };
          }),
        );
        return updated;
      });
    }
    return { deleted, failed };
  }, []);

  const saveAs = useCallback(async (id: string) => {
    return window.api.videoStudioSaveAs({ id });
  }, []);

  const createFolder = useCallback(async (name: string) => {
    const result = await window.api.videoStudioFolderCreate({ name });
    if (result.success && result.folder) {
      const galleryFolder: GalleryFolder = {
        ...result.folder,
        videoCount: 0,
        coverThumbnailUrls: [],
      };
      setFolders((prev) => [galleryFolder, ...prev]);
    }
    return result;
  }, []);

  const renameFolderAction = useCallback(async (id: string, name: string) => {
    const result = await window.api.videoStudioFolderRename({ id, name });
    if (result.success) {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)));
    }
    return result;
  }, []);

  const deleteFolderAction = useCallback(
    async (id: string, deleteVideos: boolean) => {
      const result = await window.api.videoStudioFolderDelete({ id, deleteVideos });
      if (result.success) {
        if (deleteVideos) {
          setAllVideos((prev) => prev.filter((v) => v.folderId !== id));
        } else {
          setAllVideos((prev) =>
            prev.map((v) => (v.folderId === id ? { ...v, folderId: null } : v)),
          );
        }
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (activeFolderId === id) {
          setActiveFolderId(null);
        }
      }
      return result;
    },
    [activeFolderId],
  );

  const moveToFolder = useCallback(async (videoIds: string[], folderId: string | null) => {
    const result = await window.api.videoStudioMoveToFolder({ videoIds, folderId });
    if (result.success) {
      setAllVideos((prev) => {
        const updated = prev.map((v) =>
          videoIds.includes(v.id) ? { ...v, folderId } : v,
        );
        setFolders((prevFolders) =>
          prevFolders.map((f) => {
            const folderVids = updated.filter((v) => v.folderId === f.id);
            return {
              ...f,
              videoCount: folderVids.length,
              coverThumbnailUrls: folderVids
                .slice(0, 4)
                .map((v) => v.thumbnailUrl)
                .filter((u): u is string => u !== null),
            };
          }),
        );
        return updated;
      });
    }
    return result;
  }, []);

  return {
    videos,
    allVideos,
    folders,
    activeFolderId,
    setActiveFolderId,
    basePath,
    thumbnailsBasePath,
    loading: loading || isPending,
    error,
    removeEntry,
    removeEntries,
    saveAs,
    createFolder,
    renameFolder: renameFolderAction,
    deleteFolder: deleteFolderAction,
    moveToFolder,
    refresh: loadGallery,
  };
}
