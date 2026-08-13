import fs from 'fs/promises';
import path from 'path';
import { getProjectCacheDir } from './studio-paths';
import { studioMediaJobs } from './media-jobs';

export interface CacheInfo {
  sizeBytes: number;
  fileCount: number;
}

/**
 * Size/clear operations on a project's derived-media cache (proxies, waveforms,
 * transcripts, thumbs). Everything in cache/ is re-derivable: proxies and
 * waveforms regenerate automatically on the next project open, transcripts
 * only from an explicit re-run — which is why the UI's clear confirm spells
 * that out.
 */
export async function getCacheInfo(projectId: string): Promise<CacheInfo> {
  const info: CacheInfo = { sizeBytes: 0, fileCount: 0 };
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // No cache folder yet — 0 B is the honest answer.
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(entryPath);
          info.sizeBytes += stat.size;
          info.fileCount += 1;
        } catch {
          // Deleted between readdir and stat — skip.
        }
      }
    }
  };
  await walk(await getProjectCacheDir(projectId));
  return info;
}

export async function clearCache(projectId: string): Promise<void> {
  // An ffmpeg still writing a .part file would hold a Windows lock and fail
  // the delete — abort the project's jobs first, then retry through the tail
  // of the process teardown.
  studioMediaJobs.cancelProject(projectId);
  const cacheDir = await getProjectCacheDir(projectId);
  await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  // Restore the scaffold so nothing downstream has to mkdir defensively.
  await fs.mkdir(path.join(cacheDir, 'thumbs'), { recursive: true });
}
