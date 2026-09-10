// Colours and labels the canvas, palette and thumbnail share for the shared
// port and node vocabulary (`@shared/types/flows`). Data only.

import type { DataType, NodeCategory } from '@shared/types/flows';

export const DATA_TYPE_COLOR: Record<DataType, string> = {
  text: '#5b8def',
  image: '#a575e8',
  images: '#e87fb8',
  video: '#34d399',
  videos: '#2dd4bf',
  audio: '#f59e0b',
  composition: '#f97316',
  transcript: '#22d3ee',
  number: '#94a3b8',
};

export const DATA_TYPE_LABEL: Record<DataType, string> = {
  text: 'Text',
  image: 'Image',
  images: 'Images (multiple)',
  video: 'Video',
  videos: 'Videos (multiple)',
  audio: 'Audio',
  composition: 'Composition',
  transcript: 'Transcript',
  number: 'Number',
};

/** Palette order. */
export const CATEGORY_ORDER: NodeCategory[] = [
  'input',
  'text',
  'image',
  'video',
  'audio',
  'composition',
  'library',
  'agent',
];

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Inputs',
  text: 'Text',
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  composition: 'Compositions',
  library: 'Library',
  agent: 'Agents',
};

export const CATEGORY_FILL: Record<NodeCategory, string> = {
  input: '#5b8def',
  text: '#6c8ee6',
  image: '#a575e8',
  video: '#34d399',
  audio: '#f59e0b',
  composition: '#f97316',
  library: '#94a3b8',
  agent: '#e87fb8',
};

/** The gate name on a `needs` chip, e.g. `image-provider` → "image provider". */
export function needLabel(need: string): string {
  return need.replace(/-/g, ' ');
}
