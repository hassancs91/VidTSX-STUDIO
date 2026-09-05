import type { Sd3dSource, Sd3dStage, ThreedStudioEntry } from '../../shared/ipc/types';

export type { Sd3dSource, Sd3dStage, ThreedStudioEntry };

export type Quality = '256' | '512';

/** A gallery row with renderer-playable file:// URLs. */
export interface GalleryModel extends ThreedStudioEntry {
  meshUrl: string;
  previewUrl: string | null;
  inputUrl: string | null;
}

export interface GenerationSettings {
  source: Sd3dSource;
  /** Display name of the source (file name / prompt) for the status card. */
  sourceLabel: string;
  quality: Quality;
  removeBackground: boolean;
  /** null = let the runner pick (no seed field). */
  seed: number | null;
  device: 'auto' | 'cpu';
}

export interface GenerationJob {
  requestId: string;
  stage: Sd3dStage;
  pct?: number;
  message?: string;
  label: string;
  startedAt: number;
}

export interface GenerationError {
  message: string;
  code?: string;
  details?: string;
}

export interface QualityOption {
  value: Quality;
  label: string;
  enabled: boolean;
  /** Why it is disabled (tooltip). */
  reason?: string;
}
