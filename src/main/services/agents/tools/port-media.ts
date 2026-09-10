// Media on flow ports (flows plan §1.2): what a tool does with an `image` /
// `images` / `video` argument, and how an input node files a picked file.
//
// A port carries an ARTIFACT REFERENCE — the artifact id, the same string the
// model passes to `edit_composition` — never bytes (§11). Media artifacts
// (`image-set`, `video`, `audio`) live in the asset library, so resolving one
// needs no session: the library root plus the payload's relPath. That is the
// one root rule `artifact-paths.ts` states, applied to the two kinds tools
// consume here.
//
// Inputs are COPIED into the library under `<libraryFolder>/inputs` and
// indexed as `imported` — never linked. A flow run must keep working after
// the gallery entry or the picked file is gone, and the run folder's
// artifacts.json must resolve on its own.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact, TranscriptMeta } from '../../../../shared/types/agents';
import { ensureLibraryRoot, resolveLibraryPath } from '../../library/library-paths';
import { upsertEntry } from '../../library/library-store';
import { readBrand } from '../../library/brand-store';
import { reserveLibraryFile, sanitizeFolder, slugify } from '../../library/library-filing';
import type { AgentToolContext } from './types';

const INPUTS_FOLDER = 'inputs';
const FLOWS_FOLDER = 'flows';

/** The file behind an `audio` port value (W8 Stage 3). */
export async function resolveAudioFile(
  ctx: AgentToolContext,
  artifactId: string,
): Promise<{ artifact: AgentArtifact; absPath: string }> {
  const artifact = ctx.readArtifacts().find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`No artifact "${artifactId}" in this run.`);
  if (artifact.kind !== 'audio') {
    throw new Error(`Artifact "${artifactId}" is a ${artifact.kind}, not audio.`);
  }
  const root = await ensureLibraryRoot();
  return { artifact, absPath: resolveLibraryPath(root, artifact.payload.relPath) };
}

/**
 * The `document` behind a `transcript` port value (W8 Stage 3): its payload
 * carries the `transcript` variant naming the JSON with the timings.
 */
export function resolveTranscript(
  ctx: AgentToolContext,
  artifactId: string,
): { artifact: AgentArtifact; meta: TranscriptMeta } {
  const artifact = ctx.readArtifacts().find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`No artifact "${artifactId}" in this run.`);
  if (artifact.kind !== 'document' || !artifact.payload.transcript) {
    throw new Error(`Artifact "${artifactId}" is not a transcript.`);
  }
  return { artifact, meta: artifact.payload.transcript };
}

/**
 * How a composition references library media (the trio's `image` / `video`
 * ports, flows plan §1.2 — the convention Stage 1 left open): the generation
 * prompt already teaches `staticFile('<absolute path>')` for local files, so
 * a port value becomes that expression, forward slashes, quoted for TSX.
 */
export function staticFileExpression(absPath: string): string {
  return `staticFile(${JSON.stringify(absPath.replace(/\\/g, '/'))})`;
}

export interface LibraryOutputOptions {
  /** The run's library folder; `subfolder` nests under it. */
  libraryFolder: string | undefined;
  subfolder?: string;
  baseName: string;
  /** With the dot. */
  ext: string;
}

/** Reserve `<libraryFolder>[/<subfolder>]/<base><ext>` for a tool's output; the caller writes it, then indexes it. */
export async function reserveLibraryOutput(opts: LibraryOutputOptions): Promise<{ relPath: string; absPath: string }> {
  const root = await ensureLibraryRoot();
  const base = sanitizeFolder(opts.libraryFolder, FLOWS_FOLDER);
  const folder = opts.subfolder ? `${base}/${sanitizeFolder(opts.subfolder, 'out')}` : base;
  return reserveLibraryFile(root, folder, slugify(opts.baseName), opts.ext);
}

/** Index a written output as born-managed content, brand-tagged when the brand still exists. */
export async function indexLibraryOutput(relPath: string, description: string, brandId: string | undefined): Promise<void> {
  const root = await ensureLibraryRoot();
  const brand = brandId ? await readBrand(root, brandId).catch(() => null) : null;
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description,
    ...(brand ? { brandId: brand.id } : {}),
  });
}

export interface ResolvedImage {
  absPath: string;
  relPath: string;
  width: number;
  height: number;
}

/** The `image-set` artifact behind an `image` / `images` port value. */
export async function resolveImageSet(
  ctx: AgentToolContext,
  artifactId: string,
): Promise<{ artifact: AgentArtifact; items: ResolvedImage[] }> {
  const artifact = ctx.readArtifacts().find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`No artifact "${artifactId}" in this run.`);
  if (artifact.kind !== 'image-set') {
    throw new Error(`Artifact "${artifactId}" is a ${artifact.kind}, not an image.`);
  }
  const root = await ensureLibraryRoot();
  const items = artifact.payload.items.map((item) => ({
    absPath: resolveLibraryPath(root, item.relPath),
    relPath: item.relPath,
    width: item.width,
    height: item.height,
  }));
  return { artifact, items };
}

/** The first image of an `image-set` as base64 — what the image engine takes. */
export async function readImageBase64(ctx: AgentToolContext, artifactId: string): Promise<string> {
  const { items } = await resolveImageSet(ctx, artifactId);
  const first = items[0];
  if (!first) throw new Error(`Artifact "${artifactId}" holds no image.`);
  return (await fs.readFile(first.absPath)).toString('base64');
}

/** The file behind a `video` port value. */
export async function resolveVideoFile(
  ctx: AgentToolContext,
  artifactId: string,
): Promise<{ artifact: AgentArtifact; absPath: string }> {
  const artifact = ctx.readArtifacts().find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`No artifact "${artifactId}" in this run.`);
  if (artifact.kind !== 'video') {
    throw new Error(`Artifact "${artifactId}" is a ${artifact.kind}, not a video.`);
  }
  const root = await ensureLibraryRoot();
  return { artifact, absPath: resolveLibraryPath(root, artifact.payload.relPath) };
}

export interface ImportInputOptions {
  /** The run's library folder; the copy lands in `<folder>/inputs`. */
  libraryFolder: string | undefined;
  /** Slugged into the file name. */
  baseName: string;
  /** With the dot. */
  ext: string;
  /** Exactly one of the two. */
  bytes?: Buffer;
  sourcePath?: string;
  description: string;
}

/**
 * Copy an input into the library and index it as imported content. Returns
 * the library-relative path an artifact payload stores.
 */
export async function importLibraryInput(
  opts: ImportInputOptions,
): Promise<{ relPath: string; absPath: string }> {
  const root = await ensureLibraryRoot();
  const folder = `${sanitizeFolder(opts.libraryFolder, FLOWS_FOLDER)}/${INPUTS_FOLDER}`;
  const { relPath, absPath } = await reserveLibraryFile(root, folder, slugify(opts.baseName), opts.ext);
  if (opts.bytes) {
    await fs.writeFile(absPath, opts.bytes);
  } else if (opts.sourcePath) {
    await fs.copyFile(opts.sourcePath, absPath);
  } else {
    throw new Error('importLibraryInput needs bytes or a source path');
  }
  await upsertEntry(root, relPath, { origin: 'imported', description: opts.description });
  return { relPath, absPath };
}

/** `.png` / `.jpg` / `.webp` from a content type or a file name; jpg otherwise. */
export function imageExtension(contentType: string | undefined, fileName?: string): string {
  const fromName = fileName ? path.extname(fileName).toLowerCase() : '';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(fromName)) return fromName === '.jpeg' ? '.jpg' : fromName;
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  return '.jpg';
}

/**
 * Width and height from a PNG or JPEG header; `null` when the format is not
 * one of those (WebP, a corrupt file). Cheap — a few hundred bytes read.
 */
export function readImageDimensions(bytes: Buffer): { width: number; height: number } | null {
  // PNG: signature then the IHDR chunk with width/height at 16..24.
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the markers to the first SOF (0xC0–0xCF, not C4/C8/CC).
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = bytes.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}
