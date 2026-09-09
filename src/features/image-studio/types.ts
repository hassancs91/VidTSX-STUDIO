import type { ImageStudioEntry, ImageStudioFolder } from '../../shared/ipc/types';

export type { AspectRatioPreset } from '../../shared/presets/style-presets';
export type { AspectRatioDef } from '../../shared/presets/aspect-ratios';

import type { AspectRatioPreset } from '../../shared/presets/style-presets';
import type { ImageModelParams } from '../../shared/presets/image-model-params';

export type ImageMode = 'generate' | 'edit' | 'reference' | 'bulk';

export interface GenerationSettings {
  mode: ImageMode;
  prompt: string;
  model: string;
  aspectRatio: AspectRatioPreset;
  numImages: number;
  sourceImage?: string;
  referenceImages?: string[];
  /** Advanced panel values for this request; unset fields take the model's saved override, then its defaults. */
  params?: ImageModelParams;
}

export interface GalleryImage extends ImageStudioEntry {
  thumbnailUrl: string;
}

export interface PendingGeneration {
  tempId: string;
  width: number;
  height: number;
}

export interface GalleryFolder extends ImageStudioFolder {
  imageCount: number;
  coverThumbnailUrls: string[];
}
