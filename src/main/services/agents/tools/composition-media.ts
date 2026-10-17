// Port media for `generate_composition` (W8 Stage 3; split out of
// generate-composition.ts in P3 part 7 to keep it under 300 lines).
//
// An `image` port's set goes to the builder as reference images (≤4) and its
// first image into the build's assets/ as a file the piece can show; a
// `video` port's file goes into assets/ too. The piece loads both with
// `staticFile('<name>')`, which the builder's check resolves.

import path from 'path';
import type { LlmImageIpc } from '../../../../shared/ipc/types';
import type { AgentToolContext } from './types';
import { referenceImageFor } from './composition-build';
import { resolveImageSet, resolveVideoFile } from './port-media';

/** Reference images from an `image` port. */
const REFERENCE_IMAGES_MAX = 4;

export interface BuildMedia {
  /** Lines for the builder's brief. */
  notes: string[];
  referenceImages: LlmImageIpc[];
  /** Files for the build's assets/: an absolute path and its name there. */
  assets: Array<{ path: string; name: string }>;
}

/** A port's media as the builder takes it: reference images, files in assets/, and a line each in the brief. */
export async function buildMediaFor(
  ctx: AgentToolContext,
  args: { referenceImage?: string; referenceVideo?: string },
): Promise<BuildMedia> {
  const media: BuildMedia = { notes: [], referenceImages: [], assets: [] };
  const stems = new Set<string>();
  if (args.referenceImage) {
    const { artifact, items } = await resolveImageSet(ctx, args.referenceImage);
    const first = items[0];
    if (!first) throw new Error(`Artifact "${args.referenceImage}" holds no image.`);
    for (const item of items.slice(0, REFERENCE_IMAGES_MAX)) {
      const image = referenceImageFor(item.absPath);
      if (image) media.referenceImages.push(image);
    }
    const name = path.basename(first.absPath);
    stems.add(path.parse(name).name.toLowerCase());
    media.assets.push({ path: first.absPath, name });
    const shown = media.referenceImages.length;
    media.notes.push(
      `An image "${artifact.title}" (${first.width}x${first.height}) is part of this composition: it is in assets/ as ${name}. Show it with <Img src={staticFile('${name}')} /> from remotion.` +
        (shown > 0 ? ` You can see ${shown === 1 ? 'it' : `it and the rest of its set (${shown} images)`} as reference images.` : ''),
    );
  }
  if (args.referenceVideo) {
    const { artifact, absPath } = await resolveVideoFile(ctx, args.referenceVideo);
    const parsed = path.parse(path.basename(absPath));
    // Two files with one stem share one assets lookup key, which check refuses.
    const name = stems.has(parsed.name.toLowerCase()) ? `${parsed.name}-video${parsed.ext}` : parsed.base;
    media.assets.push({ path: absPath, name });
    const seconds = artifact.kind === 'video' ? artifact.payload.durationSeconds : 0;
    media.notes.push(
      `A video "${artifact.title}" (${seconds.toFixed(1)} s) is part of this composition: it is in assets/ as ${name}. Play it with <OffthreadVideo src={staticFile('${name}')} /> from remotion, and keep it on screen for its full length unless the brief says otherwise.`,
    );
  }
  return media;
}
