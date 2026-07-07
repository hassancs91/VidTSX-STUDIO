import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  entryId: string;
}

export const inputImageFromGalleryNode: NodeTypeDefinition<Config> = {
  typeId: 'input-image-from-gallery',
  label: 'Image from Gallery',
  description: 'Pick an image from your Image Studio gallery.',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  defaultConfig: { entryId: '' },
  configSchema: [
    { kind: 'gallery-image-picker', key: 'entryId', label: 'Image' },
  ],
  async execute(_inputs, config) {
    if (!config.entryId) {
      throw new Error('No image selected');
    }
    const res = await window.api.imageStudioRead({ id: config.entryId });
    if (!res.success || !res.base64) {
      throw new Error(res.error ?? 'Failed to read image');
    }
    return { image: res.base64 };
  },
};
