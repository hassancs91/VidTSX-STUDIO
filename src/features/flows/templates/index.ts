import type { GraphJson } from '../types';
import { singlePromptImageTemplate } from './single-prompt-image';
import { galleryImageVariationTemplate } from './gallery-image-variation';
import { referenceStyleTransferTemplate } from './reference-style-transfer';

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  graph: GraphJson;
}

export const FLOW_TEMPLATES: TemplateDef[] = [
  singlePromptImageTemplate,
  galleryImageVariationTemplate,
  referenceStyleTransferTemplate,
];

export function getTemplate(id: string): TemplateDef | null {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}
