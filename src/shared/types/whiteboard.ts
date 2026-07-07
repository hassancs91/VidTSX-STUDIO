export type RevealMode = 'draw' | 'wipe' | 'stamp' | 'fade' | 'type';

export type WhiteboardBackground = 'white' | 'lined' | 'grid' | 'chalkboard';

export type TextAlignment = 'left' | 'center' | 'right';
export type TextDirection = 'auto' | 'ltr' | 'rtl';

export interface AssetPlacement {
  x: number;
  y: number;
  scale: number;
}

export interface DrawableAsset {
  kind?: 'drawable';
  id: string;
  paths: string[];
  viewBox: string;
  revealMode: RevealMode;
  duration?: number;
  strokeColor?: string;
  strokeWidth?: number;
  placement?: AssetPlacement;
}

export interface ImageAsset {
  kind: 'image';
  id: string;
  name?: string;
  src: string;
  width: number;
  height: number;
  revealMode: RevealMode;
  duration?: number;
  opacity?: number;
  placement?: AssetPlacement;
}

export type TextRevealMode = 'wipe' | 'stamp' | 'fade' | 'type' | 'draw';

export interface TextAsset {
  kind: 'text';
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  alignment: TextAlignment;
  direction: TextDirection;
  color: string;
  revealMode: TextRevealMode;
  duration?: number;
  opacity?: number;
  placement?: AssetPlacement;
}

export type Asset = DrawableAsset | ImageAsset | TextAsset;

export function isDrawableAsset(asset: Asset): asset is DrawableAsset {
  return asset.kind === undefined || asset.kind === 'drawable';
}

export function isImageAsset(asset: Asset): asset is ImageAsset {
  return asset.kind === 'image';
}

export function isTextAsset(asset: Asset): asset is TextAsset {
  return asset.kind === 'text';
}

export interface HandConfig {
  svg: string;
  tipOffset: { x: number; y: number };
  rotation?: number;
}

export interface Scene {
  assets: Asset[];
  hand: HandConfig;
  background: WhiteboardBackground;
  pxPerSec: number;
  viewBox: string;
}

export const DEFAULT_SCENE_VIEWBOX = '0 0 1280 720';
export const DEFAULT_PLACEMENT: AssetPlacement = { x: 0, y: 0, scale: 1 };

export type AssetCategory =
  | 'shapes'
  | 'nature'
  | 'objects'
  | 'arrows'
  | 'people';

export interface LibraryAsset extends DrawableAsset {
  name: string;
  category: AssetCategory;
}

export type UserSvgSource = 'upload' | 'ai-generated' | 'vectorized';

export interface UserSvgAsset extends LibraryAsset {
  source: UserSvgSource;
  createdAt: number;
  /** Set for vectorized SVGs only — points at the row in `user_images` whose
   *  raster bytes were traced. Survives the source image being deleted (the
   *  vectorized paths are self-contained). */
  sourceImageId?: string;
}

export type UserImageSource = 'upload' | 'ai-generated';

/**
 * Library record for a user-uploaded raster image. Adding one to a scene
 * produces an `ImageAsset` (this carries no placement / revealMode — those
 * are per-scene-instance).
 */
export interface UserImageAsset {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  source: UserImageSource;
  createdAt: number;
}
