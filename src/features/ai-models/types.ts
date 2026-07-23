export type ModelSubTab = 'main' | 'providers' | 'audio' | 'image' | 'video' | 'llms' | '3d' | 'embeddings';

export const SUB_TABS: Array<{ id: ModelSubTab; label: string }> = [
  { id: 'main', label: 'System' },
  { id: 'providers', label: 'Providers' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'llms', label: 'LLMs' },
  { id: '3d', label: '3D' },
  { id: 'embeddings', label: 'Embeddings' },
];
