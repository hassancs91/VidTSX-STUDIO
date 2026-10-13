// Folders of media served by URL path (TSX_BUILDER_DESIGN.md P2 part 4): a
// builder version's `vN.assets/` (or a run's `work/assets/`) is registered as
// an asset ROOT and served at `/asset-root/<token>/<path inside it>` on both
// local servers (the preview's module server and the render bundle server).
//
// Why not `/asset?path=<absolute path>`: that route takes ANY path with an
// allowed extension, and the module server answers every origin
// (`Access-Control-Allow-Origin: *`), so widening its list to the kinds a
// builder piece loads (.json for Lottie, .hdr, fonts, .bin) would let any web
// page read those files anywhere on the disk. A root serves only what is
// inside a folder the app registered. And a path URL ends in the real file
// name, so loaders that pick a parser by extension work, and a `.gltf` finds
// its `.bin` and textures beside it by relative URL.
//
// The token is a hash of the folder's absolute path: the same folder gets the
// same URL in every process run, once something has registered it again.

import { createHash } from 'crypto';
import fsSync from 'fs';
import path from 'path';
import type { Request, Response } from 'express';

export const ASSET_ROOT_ROUTE = '/asset-root';

/** What a root serves, by extension. Never code: no .js, .html, .wasm. */
export const ASSET_ROOT_EXTENSIONS: ReadonlySet<string> = new Set([
  // images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.bmp',
  // video / audio
  '.mp4', '.webm', '.mov', '.m4v', '.mp3', '.wav', '.m4a', '.ogg', '.aac', '.opus', '.flac',
  // 3D: glTF (binary, or JSON + buffers) and HDR environment maps
  '.glb', '.gltf', '.bin', '.hdr', '.exr',
  // fonts
  '.ttf', '.otf', '.woff', '.woff2',
  // data (Lottie is JSON)
  '.json', '.csv', '.txt',
]);

const roots = new Map<string, string>();

function tokenFor(dir: string): string {
  const key = process.platform === 'win32' ? dir.toLowerCase() : dir;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** Register `dir` (idempotent) and return its token. */
export function registerAssetRoot(dir: string): string {
  const abs = path.resolve(dir);
  const token = tokenFor(abs);
  roots.set(token, abs);
  return token;
}

/** `relPath` (POSIX, inside the root) as a URL on the server at `origin`. */
export function assetRootUrl(origin: string, dir: string, relPath: string): string {
  const token = registerAssetRoot(dir);
  const encoded = relPath
    .split('/')
    .filter((s) => s.length > 0)
    .map(encodeURIComponent)
    .join('/');
  return `${origin.replace(/\/+$/, '')}${ASSET_ROOT_ROUTE}/${token}/${encoded}`;
}

/** The file a request names, or why it is refused. Pure apart from the registry. */
export function resolveAssetRootRequest(token: string, relPath: string): { file: string } | { status: number; error: string } {
  const root = roots.get(token);
  if (!root) return { status: 404, error: 'Unknown asset root' };
  const file = path.resolve(root, relPath);
  if (!file.startsWith(root + path.sep)) return { status: 400, error: 'Outside the asset root' };
  if (!ASSET_ROOT_EXTENSIONS.has(path.extname(file).toLowerCase())) return { status: 400, error: 'Invalid file type' };
  return { file };
}

/** Mount with `app.get(`${ASSET_ROOT_ROUTE}/:token/*`, serveAssetRoot)` (express 4: the rest is params[0]). */
export function serveAssetRoot(req: Request, res: Response): void {
  const params = req.params as Record<string, string | undefined>;
  const resolved = resolveAssetRootRequest(params.token ?? '', params[0] ?? '');
  if ('error' in resolved) {
    res.status(resolved.status).send(resolved.error);
    return;
  }
  if (!fsSync.existsSync(resolved.file)) {
    res.status(404).send('File not found');
    return;
  }
  res.sendFile(resolved.file, { dotfiles: 'deny' });
}

/** Tests only. */
export function clearAssetRoots(): void {
  roots.clear();
}
