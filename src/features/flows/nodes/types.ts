export type DataType = 'text' | 'image' | 'images' | 'video';

export interface PortDef {
  id: string;
  label: string;
  dataType: DataType;
  required?: boolean;
}

export type ConfigField =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'prompt'; key: string; label: string; placeholder?: string; rows?: number }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'model-picker'; key: string; label: string; providerKeyKey?: string }
  | { kind: 'llm-model-picker'; key: string; label: string; providerKeyKey?: string }
  | { kind: 'video-model-picker'; key: string; label: string; providerKeyKey?: string }
  // Duration / aspect / resolution / audio / seed read from the selected
  // model's capabilities. Owns those config keys itself, the way
  // 'image-upload' owns fileName/width/height — so it needs no `label`.
  | { kind: 'video-model-options'; key: string; providerKeyKey?: string; modelKey?: string }
  | { kind: 'gallery-image-picker'; key: string; label: string }
  | { kind: 'image-upload'; key: string; label: string };

export interface ExecutionContext {
  signal: AbortSignal;
  runId: string;
  flowName: string;
  flowFolderId: string | null;
}

export type NodeCategory = 'input' | 'generate';

export interface NodeTypeDefinition<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  typeId: string;
  label: string;
  description: string;
  category: NodeCategory;
  inputs: PortDef[];
  outputs: PortDef[];
  defaultConfig: TConfig;
  configSchema: ConfigField[];
  execute: (
    inputs: Record<string, unknown>,
    config: TConfig,
    ctx: ExecutionContext,
  ) => Promise<Record<string, unknown>>;
}

export function isPortCompatible(source: DataType, target: DataType): boolean {
  if (source === target) return true;
  if (source === 'image' && target === 'images') return true;
  return false;
}

export const DATA_TYPE_COLOR: Record<DataType, string> = {
  text: '#5b8def',
  image: '#a575e8',
  images: '#e87fb8',
  video: '#34d399',
};
