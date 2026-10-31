import type { LibraryAssetKind, PlayableMediaKind } from './types/asset-library';

/**
 * The ONE extension → kind table (END_TO_END_PLAN T6, part E1). Before E1 the
 * kind was derived in two places that disagreed (`.opus`, `.mts`, `.m2ts` were
 * media to Studio import but "other" to the Assets screen; `.avif` the other
 * way round). Studio import (`classifyMediaKind`), the import dialog filters,
 * the Assets screen (`classifyAsset`) and the library index (`entry.kind`) all
 * read this table now. Keys are lower-case, dot-prefixed extensions.
 */
export const MEDIA_EXT_KIND: Readonly<Record<string, LibraryAssetKind>> = {
  // video
  '.mp4': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video',
  '.avi': 'video', '.m4v': 'video', '.mts': 'video', '.m2ts': 'video',
  // audio
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio',
  '.flac': 'audio', '.ogg': 'audio', '.opus': 'audio',
  // images (SVG: drawn by Chromium, sized from its root tag — media-import.ts)
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image',
  '.bmp': 'image', '.gif': 'image', '.svg': 'image', '.avif': 'image',
  // 3D
  '.glb': 'model3d', '.gltf': 'model3d', '.obj': 'model3d', '.fbx': 'model3d',
  // fonts
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font',
  // data
  '.json': 'data', '.txt': 'data', '.csv': 'data', '.xml': 'data', '.md': 'data',
};

/** Lower-case last extension of a file name or path ('' when none). */
export function extensionOf(nameOrPath: string): string {
  const base = nameOrPath.slice(Math.max(nameOrPath.lastIndexOf('/'), nameOrPath.lastIndexOf('\\')) + 1);
  const idx = base.lastIndexOf('.');
  return idx <= 0 ? '' : base.slice(idx).toLowerCase();
}

/** The kind of a file by its extension; 'other' when the table does not know it. */
export function mediaKindOf(nameOrPath: string): LibraryAssetKind {
  return MEDIA_EXT_KIND[extensionOf(nameOrPath)] ?? 'other';
}

/** The three kinds a timeline clip can be (Studio import accepts only these). */
export function isPlayableMediaKind(kind: LibraryAssetKind): kind is PlayableMediaKind {
  return kind === 'video' || kind === 'audio' || kind === 'image';
}

/** The kinds that have a length — the library probes these (ffprobe duration). */
export function isTimedMediaKind(kind: LibraryAssetKind | undefined): kind is 'video' | 'audio' {
  return kind === 'video' || kind === 'audio';
}

/** Every extension of one kind, in table order (dialog filters). */
export function extensionsOfKind(kind: LibraryAssetKind): string[] {
  return Object.keys(MEDIA_EXT_KIND).filter((ext) => MEDIA_EXT_KIND[ext] === kind);
}
