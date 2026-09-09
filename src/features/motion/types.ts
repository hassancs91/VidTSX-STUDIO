export const FPS_OPTIONS = [25, 30, 60, 120, 240];

export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface AspectRatioOption {
  value: AspectRatio;
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9', width: 1920, height: 1080 },
  { value: '9:16', label: '9:16', width: 1080, height: 1920 },
  { value: '1:1', label: '1:1', width: 1080, height: 1080 },
];

export const DURATION_RANGE = { min: 3, max: 60, default: 5 } as const;

export interface MotionProject {
  folderPath: string;
  name: string;
  versions: string[];
  currentVersion: string;
  currentContent: string;
}

export type { LibraryProject, LibraryFolder, LibraryState } from '@shared/types/library';
