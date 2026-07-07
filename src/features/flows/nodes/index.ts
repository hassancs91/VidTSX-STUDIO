import type { NodeCategory, NodeTypeDefinition } from './types';
import { inputPromptNode } from './input-prompt';
import { inputImageFromGalleryNode } from './input-image-from-gallery';
import { inputImageUploadNode } from './input-image-upload';
import { generateImageNode } from './generate-image';
import { generateTextNode } from './generate-text';
import { generateVideoNode } from './generate-video';

const ALL_NODES = [
  inputPromptNode,
  inputImageFromGalleryNode,
  inputImageUploadNode,
  generateImageNode,
  generateTextNode,
  generateVideoNode,
] as unknown as NodeTypeDefinition[];

export const NODE_REGISTRY: Record<string, NodeTypeDefinition> = Object.fromEntries(
  ALL_NODES.map((n) => [n.typeId, n]),
);

export const NODE_TYPES_BY_CATEGORY: Record<NodeCategory, NodeTypeDefinition[]> = {
  input: ALL_NODES.filter((n) => n.category === 'input'),
  generate: ALL_NODES.filter((n) => n.category === 'generate'),
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Inputs',
  generate: 'Generators',
};

export function getNodeDef(typeId: string): NodeTypeDefinition | null {
  return NODE_REGISTRY[typeId] ?? null;
}
