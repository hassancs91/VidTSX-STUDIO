export type ModelSubTab = 'main' | 'audio' | 'image' | 'llms' | '3d' | 'embeddings';

export const SUB_TABS: Array<{ id: ModelSubTab; label: string }> = [
  { id: 'main', label: 'System' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
  { id: 'llms', label: 'LLMs' },
  { id: '3d', label: '3D' },
  { id: 'embeddings', label: 'Embeddings' },
];
