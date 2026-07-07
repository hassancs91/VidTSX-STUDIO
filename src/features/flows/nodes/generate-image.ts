import type { ImageOperationType } from '@shared/ipc/types';
import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  providerId: string;
  model: string;
  operation: ImageOperationType;
  width: number;
  height: number;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asImageArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return arr.length > 0 ? arr : undefined;
}

export const generateImageNode: NodeTypeDefinition<Config> = {
  typeId: 'generate-image',
  label: 'Generate Image',
  description: 'Run a prompt (and optional source/reference images) through an image model.',
  category: 'generate',
  inputs: [
    { id: 'prompt', label: 'Prompt', dataType: 'text', required: true },
    { id: 'sourceImage', label: 'Source', dataType: 'image' },
    { id: 'referenceImages', label: 'References', dataType: 'images' },
  ],
  outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  defaultConfig: {
    providerId: '',
    model: '',
    operation: 'text-to-image',
    width: 1024,
    height: 1024,
  },
  configSchema: [
    { kind: 'model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
    {
      kind: 'select',
      key: 'operation',
      label: 'Operation',
      options: [
        { value: 'text-to-image', label: 'Text to image' },
        { value: 'image-to-image', label: 'Image to image' },
        { value: 'multi-reference', label: 'Multi-reference' },
      ],
    },
    { kind: 'number', key: 'width', label: 'Width', min: 256, max: 4096, step: 64 },
    { kind: 'number', key: 'height', label: 'Height', min: 256, max: 4096, step: 64 },
  ],
  async execute(inputs, config, ctx) {
    const prompt = asString(inputs.prompt);
    if (!prompt) {
      throw new Error('No prompt provided. Connect a Prompt node to the prompt input.');
    }
    if (!config.model) {
      throw new Error('No model selected. Pick a provider and model in the inspector.');
    }
    if (!config.providerId) {
      throw new Error('No provider selected. Pick a provider and model in the inspector.');
    }

    const sourceImage = asString(inputs.sourceImage);
    const referenceImages = asImageArray(inputs.referenceImages);

    const res = await window.api.imageGenerate({
      operation: config.operation,
      prompt,
      providerId: config.providerId,
      // Pair this call with the run so useFlowRun.cancel() can abort the
      // in-flight fetch via imageGenerateCancel({ callId: runId }).
      callId: ctx.runId,
      model: config.model,
      width: config.width,
      height: config.height,
      numImages: 1,
      sourceImage,
      referenceImages,
      outputFormat: 'jpeg',
    });

    if (!res.success || !res.images || res.images.length === 0) {
      throw new Error(res.error ?? 'Image generation failed');
    }

    const generated = res.images[0];

    // Phase 4 hook: when ctx.flowFolderId is wired, save to the flow's gallery folder.
    // The returned entry id is propagated as imageRef so run history can persist a
    // tiny pointer instead of the full base64 (which can be MBs per node).
    let imageRef: string | undefined;
    if (ctx.flowFolderId) {
      try {
        const saveRes = await window.api.imageStudioSave({
          base64: generated.base64,
          prompt,
          model: res.model ?? config.model,
          width: generated.width,
          height: generated.height,
          contentType: generated.contentType,
          durationMs: res.durationMs ?? 0,
          folderId: ctx.flowFolderId,
        });
        if (saveRes.success) {
          imageRef = saveRes.entry?.id;
          // Cross-feature signal: tell Image Studio's gallery hook to refresh
          // so the new folder + entry show up without an app restart.
          window.dispatchEvent(new CustomEvent('vidtsx:image-studio:refresh'));
        }
      } catch {
        // Best-effort — image is still in memory and shown on canvas.
      }
    }

    return { image: generated.base64, imageRef };
  },
};
