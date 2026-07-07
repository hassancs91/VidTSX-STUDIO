import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  prompt: string;
}

export const inputPromptNode: NodeTypeDefinition<Config> = {
  typeId: 'input-prompt',
  label: 'Prompt',
  description: 'A text prompt that flows into a generator.',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'text', label: 'Text', dataType: 'text' }],
  defaultConfig: { prompt: '' },
  configSchema: [
    { kind: 'prompt', key: 'prompt', label: 'Prompt', placeholder: 'Describe what you want…', rows: 6 },
  ],
  async execute(_inputs, config) {
    return { text: config.prompt };
  },
};
