// Render a few PNG/JPEG stills of ONE shot version (Q5 plumbing) through the
// EXPORT-parity path: the same entry-copy step (createExportEntry on a
// synthetic single-clip timeline), the same kit pin + specifier rewrite, the
// same webpack bundle — so a still shows exactly what an export would render,
// never a preview-only approximation. Cost is a bundle + one headless-Chrome
// still per frame (seconds, acceptable behind a user-triggered button).

import path from 'path';
import fs from 'fs/promises';
import { renderStill, selectComposition } from '@remotion/renderer';
import { logEngine } from '../../../logging/log-engine';
import { getAppRoot, getRemotionBinariesDir } from '../../utils/paths';
import type { StudioProject, StudioShot, StudioTimeline } from '../../../shared/types/studio';
import { bundleComposition, ensureAssetServerUrl } from '../remotion-bundler';
import { createExportEntry } from './export-entry';
import { loadProject } from './project-store';

const log = logEngine.createLogger('ShotStills');

const STILL_TIMEOUT_MS = 120_000;

/** Frames worth critiquing: skip the first/last ~15% where entrances have not
 *  landed yet and exits are already fading — a critique of an empty frame is
 *  noise. Evenly spread, deduped, always at least frame 0. */
export function pickStillFrames(durationInFrames: number, count: number): number[] {
  const last = Math.max(0, durationInFrames - 1);
  const n = Math.max(1, count);
  const frames = new Set<number>();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.15 + (0.7 * i) / (n - 1);
    frames.add(Math.min(last, Math.max(0, Math.round(last * t))));
  }
  return [...frames].sort((a, b) => a - b);
}

function shotDurationSeconds(shot: StudioShot, fps: number): number {
  if (shot.config && shot.config.durationInFrames > 0 && shot.config.fps > 0) {
    return shot.config.durationInFrames / shot.config.fps;
  }
  if (shot.anchor) return Math.max(0.5, shot.anchor.sourceEnd - shot.anchor.sourceStart);
  return 5;
}

/** A one-clip timeline holding just this shot at t=0 — serialized by the
 *  normal export serializer, so the assets props channel (D12) and the words
 *  bake (D7) behave exactly as they do on a real timeline. */
function singleShotTimeline(shot: StudioShot, fps: number): StudioTimeline {
  return {
    tracks: [
      {
        id: 'stills-track',
        kind: 'overlay',
        name: 'Stills',
        clips: [
          {
            id: `stills-${shot.id}`,
            kind: 'tsx',
            timelineStart: 0,
            duration: shotDurationSeconds(shot, fps),
            sourceIn: 0,
            tsx: { shotId: shot.id, mode: shot.kind === 'cutaway' ? 'cutaway' : 'overlay' },
          },
        ],
      },
    ],
  };
}

export interface ShotStillsResult {
  /** JPEG files on disk, in frame order (swept with the entry TTL). */
  paths: string[];
  frames: number[];
  width: number;
  height: number;
  durationInFrames: number;
}

/**
 * Render `count` stills of the shot's active version. Throws with a readable
 * message when the shot is missing/not ready or fails export validation —
 * the caller surfaces it on the job event stream.
 */
export async function renderShotStills(
  projectId: string,
  shotId: string,
  count = 3,
): Promise<ShotStillsResult> {
  const project = await loadProject(projectId);
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error(`Shot not found: ${shotId}`);
  if (shot.status !== 'ready') throw new Error(`Shot "${shot.name}" is not ready.`);

  const synthetic: StudioProject = {
    ...project,
    timeline: singleShotTimeline(shot, project.settings.fps),
    // Captions ride the master lane; a single-shot still never wants them.
    ...(project.captions ? { captions: { ...project.captions, enabled: false } } : {}),
  };

  const assetUrlBase = await ensureAssetServerUrl();
  const entry = await createExportEntry(synthetic, assetUrlBase);

  const bundle = await bundleComposition(entry.entryPath);
  if (!bundle.success || !bundle.serveUrl) {
    throw new Error(`Bundling the shot for stills failed: ${bundle.error ?? 'unknown error'}`);
  }

  const binariesDirectory = getRemotionBinariesDir() ?? undefined;
  const composition = await selectComposition({
    serveUrl: bundle.serveUrl,
    id: entry.compositionId,
    inputProps: {},
    chromiumOptions: { disableWebSecurity: true },
    timeoutInMilliseconds: STILL_TIMEOUT_MS,
    binariesDirectory,
  });

  // Own TTL-swept directory beside the entry copies (the sweep owns every
  // studio-entry-* directory in there).
  const outDir = path.join(getAppRoot(), '.vidtsx-temp', 'studio', `studio-entry-${project.id}-stills`);
  await fs.mkdir(outDir, { recursive: true });

  const frames = pickStillFrames(entry.durationInFrames, count);
  const paths: string[] = [];
  for (const frame of frames) {
    const output = path.join(outDir, `${shot.id}-v${shot.activeVersion}-f${frame}.jpg`);
    await renderStill({
      composition,
      serveUrl: bundle.serveUrl,
      output,
      frame,
      imageFormat: 'jpeg',
      jpegQuality: 85,
      inputProps: {},
      chromiumOptions: { disableWebSecurity: true },
      timeoutInMilliseconds: STILL_TIMEOUT_MS,
      binariesDirectory,
    });
    paths.push(output);
  }
  log.debug('Rendered shot stills', { shotId, frames, outDir });

  return {
    paths,
    frames,
    width: entry.width,
    height: entry.height,
    durationInFrames: entry.durationInFrames,
  };
}
