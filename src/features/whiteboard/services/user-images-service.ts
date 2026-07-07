import type { UserImageAsset } from '@shared/types/whiteboard';

export async function fetchUserImages(): Promise<UserImageAsset[]> {
  const response = await window.api.whiteboardUserImageList();
  if (!response.success || !response.images) return [];
  return response.images;
}

export async function uploadUserImage(args: {
  base64: string;
  filename: string;
  width: number;
  height: number;
}): Promise<UserImageAsset> {
  const response = await window.api.whiteboardUserImageUpload(args);
  if (!response.success || !response.image) {
    throw new Error(response.error ?? 'Failed to upload image');
  }
  return response.image;
}

export async function deleteUserImage(id: string): Promise<void> {
  const response = await window.api.whiteboardUserImageDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete image');
  }
}

/** Decode a File to its intrinsic pixel dimensions via an off-screen <img>. */
export async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Encode a File's bytes to base64 (no data: prefix). */
export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Avoid huge `String.fromCharCode(...spread)` calls — chunk to keep stack
  // pressure low for multi-MB images.
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
