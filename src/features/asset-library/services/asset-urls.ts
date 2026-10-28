import type { AssetEntry } from '../types';

/**
 * Module-server URLs for library files. The module server (main process) serves
 * any absolute path whose extension it allows at `/asset?path=…` — Range requests
 * included, so an `<audio>` can seek. The renderer never reads the file itself.
 * No server URL → null, and the caller shows its quiet fallback.
 */

export function moduleAssetUrl(serverUrl: string | null, absPath: string): string | null {
  return serverUrl ? `${serverUrl}/asset?path=${encodeURIComponent(absPath)}` : null;
}

export interface SelectedAssetUrls {
  /** An image previews itself in the details panel. */
  image: string | null;
  /** A .glb opens in the shared 3D viewer (plan §5 step 6). */
  glb: string | null;
  /** An audio file plays in the details panel's `<audio controls>` (E3). */
  audio: string | null;
}

export function selectedAssetUrls(entry: AssetEntry | undefined, serverUrl: string | null): SelectedAssetUrls {
  const none: SelectedAssetUrls = { image: null, glb: null, audio: null };
  if (!entry || entry.node.type !== 'file') return none;
  const url = moduleAssetUrl(serverUrl, entry.node.path);
  if (entry.category === 'image') return { ...none, image: url };
  if (entry.category === 'audio') return { ...none, audio: url };
  if (entry.category === 'model3d' && entry.ext.toLowerCase() === '.glb') return { ...none, glb: url };
  return none;
}
