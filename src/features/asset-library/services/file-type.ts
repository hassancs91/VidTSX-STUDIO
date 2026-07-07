import type { AssetCategory } from '../types';

const EXT_TO_CATEGORY: Record<string, AssetCategory> = {
  // video
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.mkv': 'video',
  '.avi': 'video', '.m4v': 'video',
  // audio
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.ogg': 'audio',
  '.flac': 'audio', '.aac': 'audio',
  // images
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image',
  '.webp': 'image', '.svg': 'image', '.bmp': 'image', '.avif': 'image',
  // 3D
  '.glb': 'model3d', '.gltf': 'model3d', '.obj': 'model3d', '.fbx': 'model3d',
  // fonts
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font',
  // data
  '.json': 'data', '.txt': 'data', '.csv': 'data', '.xml': 'data', '.md': 'data',
};

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

export function classifyAsset(name: string): { category: AssetCategory; ext: string } {
  const ext = getExtension(name);
  return { category: EXT_TO_CATEGORY[ext] ?? 'other', ext };
}

export function isInlinePreviewable(category: AssetCategory): boolean {
  return category === 'image';
}
