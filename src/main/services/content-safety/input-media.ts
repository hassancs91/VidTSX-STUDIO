import type { ProviderMediaInput } from '../../../video-engine/types';

/** Matches fal's per-image input cap; larger inputs are refused, not sampled. */
const MAX_INPUT_IMAGE_BYTES = 30 * 1024 * 1024;

/** Reference clips: fal allows 200 MB, but uploads are capped at 90 MB. */
const MAX_INPUT_VIDEO_BYTES = 90 * 1024 * 1024;

/**
 * Bytes of an input image for Gate B — base64 (raw or data URI) decodes
 * locally; an https URL is fetched once so the classifier sees the same
 * pixels the provider will. Every failure blocks (fail-closed).
 */
export async function readInputImageBytes(input: ProviderMediaInput): Promise<Buffer> {
  return readInputMediaBytes(input, 'image');
}

/**
 * The same for any input medium the gates read. Reference videos take this
 * path before the frame sampler, and before they are uploaded anywhere.
 */
export async function readInputMediaBytes(
  input: ProviderMediaInput,
  kind: 'image' | 'video',
): Promise<Buffer> {
  const cap = kind === 'video' ? MAX_INPUT_VIDEO_BYTES : MAX_INPUT_IMAGE_BYTES;
  if (input.kind === 'base64') {
    const raw = input.value.startsWith('data:')
      ? input.value.slice(input.value.indexOf(',') + 1)
      : input.value;
    const bytes = Buffer.from(raw, 'base64');
    if (bytes.length > cap) {
      throw new Error(`Input ${kind} too large (${bytes.length} bytes > ${cap} cap).`);
    }
    return bytes;
  }

  let res: Response;
  try {
    res = await fetch(input.value);
  } catch (err) {
    throw new Error(
      `Content Safety could not fetch this input ${kind}, so it is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Content Safety could not fetch this input ${kind} (HTTP ${res.status}), so it is blocked (fail-closed).`,
    );
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > cap) {
    throw new Error(`Input ${kind} too large (${bytes.length} bytes > ${cap} cap).`);
  }
  return bytes;
}
