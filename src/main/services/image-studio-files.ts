import { app } from 'electron';
import path from 'path';

export function getStudioDir(): string {
  return path.join(app.getPath('userData'), 'image-studio');
}

export function getImagesDir(): string {
  return path.join(getStudioDir(), 'images');
}

export function getReferencesDir(): string {
  return path.join(getStudioDir(), 'references');
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
