// Legacy renderer node definitions (retired in W8 Stage 1, when nodes become
// registry tools with ports and the palette reads `NodeSpec`s). The port and
// field types moved to `@shared/types/flows` in Stage 0; this file re-exports
// them so the canvas keeps compiling until then.

import type { DataType } from '@shared/types/flows';

export type { DataType, PortDef, ConfigField } from '@shared/types/flows';
export { isPortCompatible } from '@shared/types/flows';
import type { ConfigField, PortDef } from '@shared/types/flows';

export interface ExecutionContext {
  signal: AbortSignal;
  runId: string;
  flowName: string;
  flowFolderId: string | null;
}

/** The legacy palette's two groups — not the shared `NodeCategory`. */
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

export const DATA_TYPE_COLOR: Record<DataType, string> = {
  text: '#5b8def',
  image: '#a575e8',
  images: '#e87fb8',
  video: '#34d399',
  audio: '#f59e0b',
  composition: '#f97316',
  transcript: '#22d3ee',
  number: '#94a3b8',
};
