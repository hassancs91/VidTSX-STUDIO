/**
 * Lists the compositions a fresh bundle registers. Remotion opens a browser (and an
 * assets folder) for this, so it runs in a temp folder of its own under the export
 * scratch root and leaves nothing in `%TEMP%` (A2: a cancelled export leaves nothing).
 */
import path from 'path';
import { getCompositions } from '@remotion/renderer';
import { getRemotionBinariesDir, getTempDir } from '../utils/paths';
import { withOwnRemotionTemp } from './studio/export-engines/own-remotion-temp';
import type { CompositionMetadata } from './remotion-bundler';

export async function listBundleCompositions(serveUrl: string): Promise<CompositionMetadata[]> {
  const found = await withOwnRemotionTemp(path.join(getTempDir(), 'export'), () =>
    getCompositions(serveUrl, {
      timeoutInMilliseconds: 30000,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
    }),
  );
  return found.map((comp) => ({
    id: comp.id,
    width: comp.width,
    height: comp.height,
    fps: comp.fps,
    durationInFrames: comp.durationInFrames,
  }));
}
