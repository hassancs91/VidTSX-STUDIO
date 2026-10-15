// What the Creator's build progress panel says (P3 part 2), from the job
// snapshot alone: time, tokens, checks, the format line, each still's caption
// and its file URL. Pure: the panel only lays these out.

import type { BuildFormat, TsxBuildJobIpc, TsxBuildStillIpc, TsxJobIpc } from '@shared/ipc/types';
import { isEditJob, jobTitle } from './creator-jobs';

const BUDGET_LABELS: Record<TsxBuildJobIpc['budget'], string> = { quick: 'Quick', standard: 'Standard', craft: 'Craft' };

/** "0:42", "12:05", "1:02:05". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** 950 → "950", 12_400 → "12.4k", 1_130_000 → "1.13M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1).replace(/\.?0+$/, '')}k`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

/** Wall time of the job: ticking while it runs (the snapshot's own count moves only on events). */
export function jobElapsedMs(job: TsxJobIpc, now: number): number {
  if (!job.startedAt) return 0;
  return Math.max((job.completedAt ?? now) - job.startedAt, job.build?.elapsedMs ?? 0);
}

/** "12.4k tokens out", with every count for a tooltip. */
export function tokensText(build: TsxBuildJobIpc): { short: string; detail: string } {
  const t = build.tokens;
  return {
    short: `${formatTokens(t.output)} tokens out`,
    detail: `output ${formatTokens(t.output)} · input ${formatTokens(t.input)} · cache read ${formatTokens(t.cacheRead)} · cache write ${formatTokens(t.cacheCreation)} · ${build.turns} API turns`,
  };
}

/** "4 checks (last passed)"; a failed last check names its first error. */
export function checksText(build: TsxBuildJobIpc): { short: string; error?: string } {
  if (build.checks === 0) return { short: 'no check yet' };
  const n = `${build.checks} check${build.checks === 1 ? '' : 's'}`;
  if (!build.lastCheck) return { short: n };
  if (build.lastCheck.ok) return { short: `${n} (last passed)` };
  return { short: `${n} (last failed)`, ...(build.lastCheck.errors[0] ? { error: build.lastCheck.errors[0] } : {}) };
}

function lengthText(format: BuildFormat): string {
  if (!format.durationInFrames) return 'length: builder decides';
  const seconds = format.durationInFrames / format.fps;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

/** "Standard · 1080×1350 · 30 fps · 8 s · loop". */
export function formatLine(build: TsxBuildJobIpc): string {
  const parts = [BUDGET_LABELS[build.budget]];
  if (build.edit) parts.push('edit');
  const f = build.format;
  if (f) {
    parts.push(`${f.width}×${f.height}`, `${f.fps} fps`, lengthText(f));
    if (f.loop) parts.push('loop');
  }
  return parts.join(' · ');
}

/** Small verdicts worth a glance: the loop seam, frame purity, generated images. */
export function verdictChips(build: TsxBuildJobIpc): Array<{ text: string; bad: boolean }> {
  const chips: Array<{ text: string; bad: boolean }> = [];
  if (build.seam) chips.push({ text: build.seam.jump ? 'loop seam: jump' : 'loop seam OK', bad: build.seam.jump });
  if (build.purity) chips.push({ text: build.purity.pure ? 'frames pure' : 'frames differ', bad: !build.purity.pure });
  if (build.images && build.images.count > 0) {
    chips.push({ text: `${build.images.count} image${build.images.count === 1 ? '' : 's'} · $${build.images.costUsd.toFixed(2)}`, bad: false });
  }
  return chips;
}

/** The last round's stills: a running build holds only its latest look; a finished one holds every saved still. */
export function latestLook(stills: TsxBuildStillIpc[]): TsxBuildStillIpc[] {
  if (stills.length === 0) return [];
  const round = Math.max(...stills.map((s) => s.round));
  return stills.filter((s) => s.round === round);
}

/** "Round 2 · 6 frames" over the latest look. */
export function lookTitle(stills: TsxBuildStillIpc[]): string {
  if (stills.length === 0) return '';
  const first = stills[0];
  const round = first.round > 0 ? `Round ${first.round} · ` : '';
  if (first.size === 'sheet') return `${round}contact sheet, ${first.frames?.length ?? 1} frames`;
  if (first.size === 'phone') return `${round}phone view`;
  return `${round}${stills.length} frame${stills.length === 1 ? '' : 's'}`;
}

export function stillCaption(still: TsxBuildStillIpc): string {
  if (still.size === 'sheet') {
    const frames = still.frames ?? [still.frame];
    return `frames ${frames[0]}–${frames[frames.length - 1]}`;
  }
  return `frame ${still.frame}`;
}

/** An absolute path as a file URL the renderer can show (spaces, #, ? encoded; the drive letter kept). */
export function stillUrl(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  const encoded = parts.map((part, i) => (i === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part))).join('/');
  return encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`;
}

/** The panel's header: "Build · bounce-2", or for an edit "Edit · bounce-2 · v2" (the version it continues). */
export function panelTitle(job: TsxJobIpc): { kind: 'Build' | 'Edit'; name: string } {
  if (!isEditJob(job)) return { kind: 'Build', name: jobTitle(job) };
  const from = job.build?.editVersion;
  return { kind: 'Edit', name: from !== undefined ? `${jobTitle(job)} · v${from}` : jobTitle(job) };
}

/** The line under a build that stopped: why, in plain words. */
export function outcomeText(job: TsxJobIpc): { text: string; bad: boolean } | null {
  if (job.status === 'error') return { text: job.error ?? (isEditJob(job) ? 'The edit failed.' : 'The build failed.'), bad: true };
  if (job.status === 'cancelled') return { text: 'Cancelled. Nothing was saved.', bad: false };
  if (job.status === 'done') {
    if (job.build?.notice) return { text: job.build.notice, bad: false };
    if (!job.versionPath) return { text: 'Finished.', bad: false };
    if (isEditJob(job)) return { text: `Saved as ${job.versionPath.split(/[\\/]/).pop()?.replace(/\.tsx$/, '')}.`, bad: false };
    return { text: `Saved as ${job.projectName ?? 'a new project'}.`, bad: false };
  }
  return null;
}
