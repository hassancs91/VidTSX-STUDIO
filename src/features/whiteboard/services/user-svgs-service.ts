import type { UserSvgAsset } from '@shared/types/whiteboard';

export function generateUserSvgId(): string {
  return `usvg-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export async function fetchUserSvgs(): Promise<UserSvgAsset[]> {
  const response = await window.api.whiteboardUserSvgList();
  if (!response.success || !response.svgs) return [];
  return response.svgs;
}

export async function saveUserSvg(asset: UserSvgAsset): Promise<void> {
  const response = await window.api.whiteboardUserSvgSave({ asset });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to save user SVG');
  }
}

export async function deleteUserSvg(id: string): Promise<void> {
  const response = await window.api.whiteboardUserSvgDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete user SVG');
  }
}

export function deriveNameFromFile(file: File): string {
  const stem = file.name.replace(/\.[^.]+$/, '').trim();
  return stem || 'Untitled SVG';
}
