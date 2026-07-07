export type {
  RevealMode,
  WhiteboardBackground,
  AssetPlacement,
  DrawableAsset,
  ImageAsset,
  TextAsset,
  TextAlignment,
  TextDirection,
  TextRevealMode,
  Asset,
  HandConfig,
  Scene,
  AssetCategory,
  LibraryAsset,
  UserSvgSource,
  UserSvgAsset,
  UserImageSource,
  UserImageAsset,
} from '@shared/types/whiteboard';

export {
  DEFAULT_SCENE_VIEWBOX,
  DEFAULT_PLACEMENT,
  isDrawableAsset,
  isImageAsset,
  isTextAsset,
} from '@shared/types/whiteboard';

/**
 * UI-only selection state. Lives in the editor; never persisted to the scene
 * contract. `null` means nothing is selected.
 */
export type Selection = { assetIndex: number } | null;

export interface PenPosition {
  x: number;
  y: number;
}

export interface AnimatorState {
  elapsed: number;
  playing: boolean;
  totalDuration: number;
  activePathIndex: number | null;
  activeAssetIndex: number | null;
  penPosition: PenPosition | null;
}
