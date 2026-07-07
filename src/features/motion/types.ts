export type ColorPalette = 'custom' | 'vibrant' | 'pastel' | 'neon' | 'earth' | 'ocean' | 'sunset' | 'monochrome' | 'retro' | 'dark-luxury' | 'candy';

export interface ColorPaletteOption {
  value: ColorPalette;
  label: string;
  colors: string[];
}

export const COLOR_PALETTES: ColorPaletteOption[] = [
  { value: 'custom', label: 'Custom', colors: [] },
  { value: 'vibrant', label: 'Vibrant', colors: ['#FF3366', '#FF6B35', '#FFD23F', '#06D6A0', '#118AB2'] },
  { value: 'pastel', label: 'Pastel', colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'] },
  { value: 'neon', label: 'Neon', colors: ['#FF00FF', '#00FFFF', '#FF00AA', '#AAFF00', '#FF6600'] },
  { value: 'earth', label: 'Earth', colors: ['#8B4513', '#D2691E', '#CD853F', '#DEB887', '#F5DEB3'] },
  { value: 'ocean', label: 'Ocean', colors: ['#001F3F', '#003366', '#0074D9', '#7FDBFF', '#B0E0E6'] },
  { value: 'sunset', label: 'Sunset', colors: ['#FF4500', '#FF6347', '#FF7F50', '#FFB347', '#FFDAB9'] },
  { value: 'monochrome', label: 'Mono', colors: ['#111111', '#333333', '#666666', '#999999', '#CCCCCC'] },
  { value: 'retro', label: 'Retro', colors: ['#E63946', '#F1A208', '#2A9D8F', '#264653', '#E9C46A'] },
  { value: 'dark-luxury', label: 'Luxury', colors: ['#1A1A2E', '#16213E', '#0F3460', '#E94560', '#D4AF37'] },
  { value: 'candy', label: 'Candy', colors: ['#FF69B4', '#FF1493', '#DA70D6', '#BA55D3', '#9370DB'] },
];

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
