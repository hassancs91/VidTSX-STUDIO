import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  providerId: string;
  model: string;
  systemPrompt: string;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const generateTextNode: NodeTypeDefinition<Config> = {
  typeId: 'generate-text',
  label: 'Generate Text',
  description: 'Run a prompt through an LLM provider and emit the response text.',
  category: 'generate',
  inputs: [{ id: 'prompt', label: 'Prompt', dataType: 'text', required: true }],
  outputs: [{ id: 'text', label: 'Text', dataType: 'text' }],
  defaultConfig: {
    providerId: '',
    model: '',
    systemPrompt: '',
  },
  configSchema: [
    { kind: 'llm-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
    {
      kind: 'prompt',
      key: 'systemPrompt',
      label: 'System prompt (optional)',
      placeholder: 'Set the assistant’s role, tone, constraints…',
      rows: 4,
    },
  ],
  async execute(inputs, config, ctx) {
    const prompt = asString(inputs.prompt);
    if (!prompt) {
      throw new Error('No prompt provided. Connect a Prompt node to the prompt input.');
    }
    if (!config.providerId) {
      throw new Error('No provider selected. Pick a provider and model in the inspector.');
    }
    if (!config.model) {
      throw new Error('No model set. Type a model id in the inspector.');
    }

    // Note: ctx.runId could pair this call with a per-call cancel IPC later.
    // Today llmCancel aborts the global active call, so we don't pass it as
    // sessionScope (that would conflate cancellation with conversation reuse).
    const res = await window.api.llmGenerate({
      providerId: config.providerId,
      model: config.model,
      prompt,
      systemPrompt: asString(config.systemPrompt),
      featureSource: 'flows',
    });

    if (!res.success || !res.text) {
      throw new Error(res.error ?? 'LLM generation failed');
    }

    return { text: res.text };
  },
};
