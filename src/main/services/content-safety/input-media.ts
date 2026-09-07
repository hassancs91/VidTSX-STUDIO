import type { ProviderMediaInput } from '../../../video-engine/types';

/** Matches fal's per-image input cap; larger inputs are refused, not sampled. */
const MAX_INPUT_IMAGE_BYTES = 30 * 1024 * 1024;

/**
 * Bytes of an input image for Gate B — base64 (raw or data URI) decodes
 * locally; an https URL is fetched once so the classifier sees the same
 * pixels the provider will. Every failure blocks (fail-closed).
 */
export async function readInputImageBytes(input: ProviderMediaInput): Promise<Buffer> {
  if (input.kind === 'base64') {
    const raw = input.value.startsWith('data:')
      ? input.value.slice(input.value.indexOf(',') + 1)
      : input.value;
    return Buffer.from(raw, 'base64');
  }

  let res: Response;
  try {
    res = await fetch(input.value);
  } catch (err) {
    throw new Error(
      `Content Safety could not fetch this input image, so it is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Content Safety could not fetch this input image (HTTP ${res.status}), so it is blocked (fail-closed).`,
    );
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error(`Input image too large (${bytes.length} bytes > ${MAX_INPUT_IMAGE_BYTES} cap).`);
  }
  return bytes;
}
