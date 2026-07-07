import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  base64: string;
  fileName: string;
  width: number;
  height: number;
  contentType: string;
}

export const inputImageUploadNode: NodeTypeDefinition<Config> = {
  typeId: 'input-image-upload',
  label: 'Upload Image',
  description: 'Upload an image from disk. Auto-downscaled to keep flows light.',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  defaultConfig: { base64: '', fileName: '', width: 0, height: 0, contentType: 'image/jpeg' },
  configSchema: [
    { kind: 'image-upload', key: 'base64', label: 'Image file' },
  ],
  async execute(_inputs, config) {
    if (!config.base64) {
      throw new Error('No image uploaded');
    }
    return { image: config.base64 };
  },
};
