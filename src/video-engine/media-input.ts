import fs from 'fs/promises';
import path from 'path';
import type { MediaInput, ProviderMediaInput } from './types';

const CONTENT_TYPES_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Resolve a caller-supplied media input to what gates and providers consume:
 * a local path becomes base64 bytes; base64 and URLs pass through. Data URIs
 * are accepted in the base64 form and left intact (dialects keep them).
 */
export async function resolveMediaInput(input: MediaInput): Promise<ProviderMediaInput> {
  if (input.kind === 'path') {
    const bytes = await fs.readFile(input.value);
    const contentType =
      input.contentType ?? CONTENT_TYPES_BY_EXT[path.extname(input.value).toLowerCase()];
    return {
      kind: 'base64',
      value: bytes.toString('base64'),
      ...(contentType ? { contentType } : {}),
    };
  }
  return {
    kind: input.kind,
    value: input.value,
    ...(input.contentType ? { contentType: input.contentType } : {}),
  };
}

/**
 * The IPC form of a frame: raw base64 bytes or an https URL in one string.
 * Anything that is not an http(s) URL is treated as base64 (data URIs too).
 */
export function mediaInputFromString(value: string): MediaInput {
  return /^https?:\/\//i.test(value)
    ? { kind: 'url', value }
    : { kind: 'base64', value };
}
