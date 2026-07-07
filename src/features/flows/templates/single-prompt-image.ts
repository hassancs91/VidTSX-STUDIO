import type { TemplateDef } from './index';

export const singlePromptImageTemplate: TemplateDef = {
  id: 'single-prompt-image',
  name: 'Prompt to image',
  description: 'A single text prompt that generates one image. The hello-world flow.',
  graph: {
    nodes: [
      {
        id: 'tpl-prompt',
        type: 'flowNode',
        position: { x: 80, y: 160 },
        data: {
          typeId: 'input-prompt',
          config: { prompt: '' },
        },
      },
      {
        id: 'tpl-generate',
        type: 'flowNode',
        position: { x: 480, y: 120 },
        data: {
          typeId: 'generate-image',
          config: {
            providerId: '',
            model: '',
            operation: 'text-to-image',
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
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};
