import path from 'path';
import { getThreedStudioDir } from '../utils/paths';

/**
 * 3D Studio storage layout (plan §5 step 3):
 *   {userData}/threed-studio/models/<id>/{mesh.glb, input.png, preview.png, request.json}
 * plus threed-studio.db next to `models/`.
 */
export function getStudioDir(): string {
  return getThreedStudioDir();
}

export function getModelsDir(): string {
  return path.join(getStudioDir(), 'models');
}

export function getModelDir(dirName: string): string {
  return path.join(getModelsDir(), dirName);
}

export const MESH_FILE_NAME = 'mesh.glb';
export const PREVIEW_FILE_NAME = 'preview.png';
export const INPUT_FILE_NAME = 'input.png';
export const REQUEST_FILE_NAME = 'request.json';

/** Resolve a name inside a base directory, null when it escapes (traversal guard). */
export function safeResolvePath(basePath: string, name: string): string | null {
  const resolved = path.resolve(basePath, name);
  const normalizedBase = path.resolve(basePath) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(basePath)) {
    return null;
  }
  return resolved;
}
