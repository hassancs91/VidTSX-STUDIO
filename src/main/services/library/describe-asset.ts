import fs from 'fs/promises';
import path from 'path';
import type { LlmImageIpc } from '../../../shared/ipc/types/llm';
import { logEngine } from '../../../logging/log-engine';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { resolveLibraryPath } from './library-paths';
import { setDescription } from './library-store';

const log = logEngine.createLogger('LibraryDescribe');

/**
 * One vision call → one library description (ASSET_LIBRARY_DESIGN.md L2).
 *
 * The description is what the Studio agent actually reads when picking an
 * asset, so the prompt asks for the things a filename can't say: what the
 * thing IS, and where it can be used. No provider is named — describing
 * always runs on the app-default provider (library curation has no project
 * context), which is `runLlmGenerate` with no `providerId`.
 */

/** Vision-capable image types the attachment format supports. */
const MEDIA_TYPES: Record<string, LlmImageIpc['mediaType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Providers reject oversized attachments; a library PNG over this is a mistake. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SYSTEM_PROMPT = [
  'You caption assets in a video producer\'s media library.',
  'Reply with ONE sentence, at most 20 words, no preamble and no quotes.',
  'Say what the asset IS and how it would be used — subject, style, background',
  '(transparent/solid/photo), and any text baked into it.',
  'Example: "primary logo, white wordmark on transparent, use on dark backgrounds".',
].join(' ');

/** Describable = an image format the vision attachment can carry. */
export function isDescribable(relPath: string): boolean {
  return path.extname(relPath).toLowerCase() in MEDIA_TYPES;
}

export function mediaTypeFor(relPath: string): LlmImageIpc['mediaType'] | undefined {
  return MEDIA_TYPES[path.extname(relPath).toLowerCase()];
}

/** Strip the model's stray quotes/bullets and clamp to a single line. */
export function cleanDescription(text: string): string {
  const firstLine = text.trim().split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  return firstLine
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^["'“”]|["'“”]$/g, '')
    .trim();
}

export interface DescribeAssetResult {
  description: string;
}

/**
 * Describe one asset and persist the result into the index overlay.
 * Throws on any failure — the batch engine catches per item, so one
 * unreadable file never takes the run down (L2: failures per-item, never
 * batch-fatal).
 */
export async function describeAsset(
  root: string,
  relPath: string,
  signal?: AbortSignal,
): Promise<DescribeAssetResult> {
  const mediaType = mediaTypeFor(relPath);
  if (!mediaType) throw new Error('Not an image file');

  const absPath = resolveLibraryPath(root, relPath); // traversal guard
  const stat = await fs.stat(absPath);
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large to describe (${Math.round(stat.size / 1024 / 1024)} MB)`);
  }
  const data = (await fs.readFile(absPath)).toString('base64');

  const res = await runLlmGenerate(
    {
      prompt: `Describe this library asset. Its filename is "${path.basename(relPath)}".`,
      systemPrompt: SYSTEM_PROMPT,
      images: [{ data, mediaType }],
      maxTokens: 200,
      featureSource: 'library-describe',
    },
    signal,
  );
  if (!res.success || !res.text) {
    throw new Error(res.error ?? 'The provider returned no description');
  }
  const description = cleanDescription(res.text);
  if (description === '') throw new Error('The provider returned an empty description');

  await setDescription(root, relPath, description);
  log.debug('Described asset', { relPath, length: description.length });
  return { description };
}
