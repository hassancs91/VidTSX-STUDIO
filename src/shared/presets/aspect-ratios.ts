import type { AspectRatioPreset } from './style-presets';

export interface AspectRatioDef {
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIOS: Record<AspectRatioPreset, AspectRatioDef> = {
  '1:1': { label: '1:1', width: 1024, height: 1024 },
  '16:9': { label: '16:9', width: 1344, height: 768 },
  '9:16': { label: '9:16', width: 768, height: 1344 },
  '4:3': { label: '4:3', width: 1184, height: 896 },
  '3:2': { label: '3:2', width: 1248, height: 832 },
};

export const ASPECT_RATIO_KEYS: AspectRatioPreset[] = ['1:1', '16:9', '9:16', '4:3', '3:2'];
