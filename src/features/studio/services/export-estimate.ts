/**
 * The Export dialog's heavy-footage notice (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md):
 * which timeline sources are expensive to decode, and a static estimate of
 * the export time per engine. Pure; the dialog renders what this returns.
 *
 * Phase 1 estimates from one measured class: 4K HEVC 60 fps camera files
 * through the browser ran at 0.8 frames per second on 2026-09-12 (video-10,
 * 1080p project, the compositor pinned on the decode), and the passthrough
 * engine copies such footage at 3.9× realtime (T1 leg 2). Phase 2 replaces
 * the table with the last measured rate of the same project from the queue
 * history. A 10-bit pixel format would also count, but the asset probe does
 * not record it — codec, size and frame rate are what it has.
 */
import type { StudioProject } from '@shared/types/studio';
import type { ExportSpanPlan } from '@shared/studio/export-spans';

export interface HeavyFootage {
  assetId: string;
  fileName: string;
  /** Why it is heavy, in the words the notice shows ("4K", "HEVC", "60 fps"). */
  reasons: string[];
}

/** Browser frames per second on heavy footage, measured 2026-09-12. */
export const HEAVY_BROWSER_FPS = 0.8;
/** Copied spans, multiples of realtime (T1 leg 2). */
export const COPY_REALTIME = 3.9;

/** The video assets on the timeline whose decode dominates an export. */
export function heavyFootageOf(project: StudioProject): HeavyFootage[] {
  const onTimeline = new Set<string>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === 'video' && clip.assetId) onTimeline.add(clip.assetId);
    }
  }
  const heavy: HeavyFootage[] = [];
  for (const asset of project.assets) {
    if (!onTimeline.has(asset.id)) continue;
    const reasons: string[] = [];
    const { width, height, fps, codec } = asset.probe;
    if (Math.min(width ?? 0, height ?? 0) >= 2160 || Math.max(width ?? 0, height ?? 0) >= 3840) reasons.push('4K');
    if (codec && /^(hevc|h265|hvc1|hev1)$/i.test(codec)) reasons.push('HEVC');
    if (fps !== undefined && fps >= 50) reasons.push(`${Math.round(fps)} fps`);
    if (reasons.length > 0) heavy.push({ assetId: asset.id, fileName: asset.path.split(/[\\/]/).pop() ?? asset.path, reasons });
  }
  return heavy;
}

export interface ExportEstimate {
  /** Seconds through the Standard engine (every frame in the browser). */
  standardSeconds: number;
  /** Seconds through the Fast engine (copied spans at COPY_REALTIME, the rest in the browser). */
  fastSeconds: number;
}

/** Static Phase 1 estimate for a timeline of heavy footage. */
export function estimateExport(plan: Pick<ExportSpanPlan, 'totalFrames' | 'copiedFrames'>, fps: number): ExportEstimate {
  const browserFrames = plan.totalFrames - plan.copiedFrames;
  return {
    standardSeconds: plan.totalFrames / HEAVY_BROWSER_FPS,
    fastSeconds: browserFrames / HEAVY_BROWSER_FPS + plan.copiedFrames / fps / COPY_REALTIME,
  };
}

/** The queue-job fields the measured estimate reads (a `RenderQueueJob` subset). */
export interface MeasuredExportJob {
  compositionId: string;
  status: string;
  exportEngine?: string;
  exportSource?: string;
  /** A dev verify run renders a second export after the first — its wall time is no measurement. */
  verifyAgainstEngine?: string;
  totalFrames: number;
  startedAt?: number;
  completedAt?: number;
}

export interface MeasuredExportRate {
  /** Wall seconds per output frame the last matching export took. */
  secondsPerFrame: number;
  /** When that export finished (ms), for the notice's "last export" wording. */
  completedAt: number;
}

/**
 * Phase 2: the rate the LAST finished export of this project through the same
 * engine and source actually ran at, from the queue's own records — the
 * estimate that knows this machine and this footage. Null when there is no
 * such export yet (the static table is the fallback). A cancelled or failed
 * job is not a measurement; an export under 30 frames is too short to be one.
 */
export function measuredExportRate(jobs: readonly MeasuredExportJob[], compositionId: string, engineId: string, source: string): MeasuredExportRate | null {
  let best: MeasuredExportRate | null = null;
  for (const job of jobs) {
    if (job.compositionId !== compositionId || job.status !== 'done' || job.verifyAgainstEngine) continue;
    if ((job.exportEngine ?? '') !== engineId || (job.exportSource ?? 'original') !== source) continue;
    if (!job.startedAt || !job.completedAt || job.completedAt <= job.startedAt || job.totalFrames < 30) continue;
    const secondsPerFrame = (job.completedAt - job.startedAt) / 1000 / job.totalFrames;
    if (!best || job.completedAt > best.completedAt) best = { secondsPerFrame, completedAt: job.completedAt };
  }
  return best;
}

/** "about 7 h", "about 45 min", "about a minute", "under a minute". */
export function formatEstimate(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'unknown';
  if (seconds < 45) return 'under a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes <= 1) return 'about a minute';
  if (minutes < 90) return `about ${minutes} min`;
  const hours = Math.round((seconds / 3600) * 2) / 2;
  return `about ${hours % 1 === 0 ? hours : hours.toFixed(1)} h`;
}
