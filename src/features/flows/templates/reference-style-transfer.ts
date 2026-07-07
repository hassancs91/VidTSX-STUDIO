import type { TemplateDef } from './index';

export const referenceStyleTransferTemplate: TemplateDef = {
  id: 'reference-style-transfer',
  name: 'Reference style transfer',
  description: 'Combine a prompt with two reference images for multi-reference generation.',
  graph: {
    nodes: [
      {
        id: 'tpl-prompt',
        type: 'flowNode',
        position: { x: 80, y: 80 },
        data: {
          typeId: 'input-prompt',
          config: { prompt: '' },
        },
      },
      {
        id: 'tpl-ref-1',
        type: 'flowNode',
        position: { x: 80, y: 240 },
        data: {
          typeId: 'input-image-from-gallery',
          config: { entryId: '' },
        },
      },
      {
        id: 'tpl-ref-2',
        type: 'flowNode',
        position: { x: 80, y: 400 },
        data: {
          typeId: 'input-image-from-gallery',
          config: { entryId: '' },
        },
      },
      {
        id: 'tpl-generate',
        type: 'flowNode',
        position: { x: 480, y: 200 },
        data: {
          typeId: 'generate-image',
          config: {
            providerId: '',
            model: '',
            operation: 'multi-reference',
            width: 1024,
            height: 1024,
          },
        },
      },
    ],
    edges: [
      {
        id: 'tpl-e-prompt-to-generate',
        source: 'tpl-prompt',
        target: 'tpl-generate',
        sourceHandle: 'text',
        targetHandle: 'prompt',
      },
      {
        id: 'tpl-e-ref1-to-generate',
        source: 'tpl-ref-1',
        target: 'tpl-generate',
        sourceHandle: 'image',
        targetHandle: 'referenceImages',
      },
      {
        id: 'tpl-e-ref2-to-generate',
        source: 'tpl-ref-2',
        target: 'tpl-generate',
        sourceHandle: 'image',
        targetHandle: 'referenceImages',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};
