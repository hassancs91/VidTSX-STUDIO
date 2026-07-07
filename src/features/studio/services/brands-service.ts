import type { StudioBrand } from '@shared/ipc/types';

export async function fetchBrands(): Promise<StudioBrand[]> {
  const response = await window.api.studioBrandList();
  if (!response.success || !response.brands) return [];
  return response.brands;
}

export async function saveBrand(brand: StudioBrand): Promise<void> {
  const response = await window.api.studioBrandSave({ brand });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to save brand');
  }
}

export async function deleteBrand(id: string): Promise<void> {
  const response = await window.api.studioBrandDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete brand');
  }
}

export function generateBrandId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function createEmptyBrand(): StudioBrand {
  const now = Date.now();
  const id = generateBrandId();
  return {
    id,
    name: 'Untitled brand',
    content: '',
    createdAt: now,
    updatedAt: now,
  };
}
