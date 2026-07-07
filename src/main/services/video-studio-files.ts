import { app } from 'electron';
import path from 'path';

export function getStudioDir(): string {
  return path.join(app.getPath('userData'), 'video-studio');
}

export function getVideosDir(): string {
  return path.join(getStudioDir(), 'videos');
}

export function getThumbnailsDir(): string {
  return path.join(getStudioDir(), 'thumbnails');
}

/** Resolve a filename within a base directory, returning null if it escapes. */
export function safeResolvePath(basePath: string, fileName: string): string | null {
  const resolved = path.resolve(basePath, fileName);
  const normalizedBase = path.resolve(basePath) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(basePath)) {
    return null;
  }
  return resolved;
}
