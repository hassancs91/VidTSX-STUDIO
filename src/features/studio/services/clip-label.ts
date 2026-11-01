import type { StudioClip, StudioClipKind, StudioMediaAsset, StudioShot } from '../types';

/** What a clip with nothing better to show is called on the timeline. */
const KIND_NAME: Record<StudioClipKind, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Image',
  tsx: 'Shot',
  caption: 'Captions',
  sfx: 'Sound effect',
};

/**
 * The name a clip goes by on the timeline, in the Inspector and in the
 * Transitions tab: its own label, else its source file's name, else its
 * shot's name, else a readable kind name. Shot clips carry no label of their
 * own (`clipFromShot`), so before the shot lookup a shot placed from the pool
 * read "tsx".
 */
export function clipDisplayLabel(
  clip: StudioClip,
  assetById: ReadonlyMap<string, StudioMediaAsset>,
  shotById: ReadonlyMap<string, StudioShot>,
): string {
  if (clip.label) return clip.label;
  const asset = clip.assetId ? assetById.get(clip.assetId) : undefined;
  if (asset) return asset.path.split(/[\\/]/).pop() ?? asset.path;
  const shot = clip.tsx ? shotById.get(clip.tsx.shotId) : undefined;
  if (shot?.name) return shot.name;
  return KIND_NAME[clip.kind] ?? clip.kind;
}
