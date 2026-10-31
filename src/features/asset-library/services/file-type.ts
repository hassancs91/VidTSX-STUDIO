import { extensionOf, mediaKindOf } from '@shared/media-kinds';
import type { AssetCategory } from '../types';

// The category IS the library kind: one extension table for the Assets
// screen, Studio import and the library index (src/shared/media-kinds.ts, E1).

export function getExtension(name: string): string {
  return extensionOf(name);
}

export function classifyAsset(name: string): { category: AssetCategory; ext: string } {
  return { category: mediaKindOf(name), ext: getExtension(name) };
}

export function isInlinePreviewable(category: AssetCategory): boolean {
  return category === 'image';
}
