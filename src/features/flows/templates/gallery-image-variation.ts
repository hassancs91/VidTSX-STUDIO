import type { TemplateDef } from './index';

export const galleryImageVariationTemplate: TemplateDef = {
  id: 'gallery-image-variation',
  name: 'Gallery image variation',
  description: 'Pick an image from your gallery, describe an edit, and generate a variation.',
  graph: {
    nodes: [
      {
        id: 'tpl-gallery',
        type: 'flowNode',
        position: { x: 80, y: 80 },
        data: {
          typeId: 'input-image-from-gallery',
          config: { entryId: '' },
        },
      },
      {
        id: 'tpl-prompt',
        type: 'flowNode',
        position: { x: 80, y: 280 },
        data: {
          typeId: 'input-prompt',
          config: { prompt: '' },
        },
      },
      {
        id: 'tpl-generate',
        type: 'flowNode',
        position: { x: 480, y: 160 },
        data: {
          typeId: 'generate-image',
          config: {
            providerId: '',
            model: '',
            operation: 'image-to-image',
            width: 1024,
            height: 1024,
          },
        },
      },
    ],
    edges: [
      {
        id: 'tpl-e-gallery-to-source',
        source: 'tpl-gallery',
        target: 'tpl-generate',
        sourceHandle: 'image',
        targetHandle: 'sourceImage',
      },
      {
        id: 'tpl-e-prompt-to-generate',
        source: 'tpl-prompt',
        target: 'tpl-generate',
        sourceHandle: 'text',
        targetHandle: 'prompt',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};
