export type ModelSubTab = 'main' | 'providers' | 'audio' | 'image' | 'video' | 'llms' | '3d' | 'embeddings' | 'safety';

export const SUB_TABS: Array<{ id: ModelSubTab; label: string }> = [
  { id: 'main', label: 'System' },
  { id: 'providers', label: 'Providers' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'llms', label: 'LLMs' },
  { id: '3d', label: '3D' },
  { id: 'embeddings', label: 'Embeddings' },
  // Deliberately unflagged: the Content Safety page is always visible (D2d —
  // the gate has no off state, and the page is the advertised surface).
  { id: 'safety', label: 'Content Safety' },
];
