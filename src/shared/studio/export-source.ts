/**
 * The Export dialog's Source option (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md
 * Phase 2): which video file each timeline asset is READ from — the original
 * camera file, or the 540p H.264 proxy the project keeps in `cache/proxies/`
 * for the preview. Decoding the original is the whole cost of exporting
 * heavy footage (0.8 fps on 4K HEVC 60 fps, 2026-09-12), so a draft from the
 * proxies is what makes a check-the-cut export fast. The audio pass reads
 * the originals in every mode. Pure; both processes read it.
 */
import type { StudioProject } from '../types/studio';

export type ExportSource = 'original' | 'proxy';

export function isExportSource(value: unknown): value is ExportSource {
  return value === 'original' || value === 'proxy';
}

/** Proxies are 540p; at or under this output short side a draft reads them by default. */
export const PROXY_DEFAULT_MAX_SHORT_SIDE = 540;

/** Queue-row badge and filename suffix for a proxy-sourced export. */
export const DRAFT_LABEL = 'draft';

export interface ProxySourceAvailability {
  /** Every video asset a video clip on the timeline plays has a ready proxy. */
  available: boolean;
  /** Timeline video assets without a ready proxy (file names), for the dialog's note. */
  missing: string[];
  /** How many timeline video assets there are at all (0 = nothing to draft). */
  videoAssets: number;
}

/**
 * The plan's availability rule: offered only when EVERY video asset on the
 * timeline has `proxy.status === 'ready'` — a draft that silently mixed
 * originals in would be as slow as a full export at the wrong moment.
 */
export function proxySourceAvailability(project: StudioProject): ProxySourceAvailability {
  const onTimeline = new Set<string>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === 'video' && clip.assetId) onTimeline.add(clip.assetId);
    }
  }
  const missing: string[] = [];
  let videoAssets = 0;
  for (const asset of project.assets) {
    if (!onTimeline.has(asset.id) || asset.kind !== 'video') continue;
    videoAssets++;
    if (asset.proxy?.status !== 'ready') missing.push(asset.path.split(/[\\/]/).pop() ?? asset.path);
  }
  return { available: videoAssets > 0 && missing.length === 0, missing, videoAssets };
}

/** The toggle's automatic default: proxies at ≤ 540p output, originals above. */
export function defaultExportSource(outputWidth: number, outputHeight: number, available: boolean): ExportSource {
  if (!available) return 'original';
  return Math.min(outputWidth, outputHeight) <= PROXY_DEFAULT_MAX_SHORT_SIDE ? 'proxy' : 'original';
}

/** `_720p`, `_540p-draft`, `_draft` — what a scaled and/or drafted file is named for. */
export function exportFileSuffix(resolution: string | undefined, source: ExportSource | undefined): string {
  const parts: string[] = [];
  if (resolution && resolution !== 'original') parts.push(resolution);
  if (source === 'proxy') parts.push(DRAFT_LABEL);
  return parts.length ? `_${parts.join('-')}` : '';
}
