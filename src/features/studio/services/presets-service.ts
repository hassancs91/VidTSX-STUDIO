import type { StudioPreset } from '@shared/ipc/types';

export async function fetchPresets(): Promise<StudioPreset[]> {
  const response = await window.api.studioPresetList();
  if (!response.success || !response.presets) return [];
  return response.presets;
}

export async function savePreset(preset: StudioPreset): Promise<void> {
  const response = await window.api.studioPresetSave({ preset });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to save preset');
  }
}

export async function deletePreset(id: string): Promise<void> {
  const response = await window.api.studioPresetDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete preset');
  }
}

export function generatePresetId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function createEmptyPreset(): StudioPreset {
  const now = Date.now();
  const id = generatePresetId();
  return {
    id,
    name: 'Untitled preset',
    content: '',
    createdAt: now,
    updatedAt: now,
  };
}
