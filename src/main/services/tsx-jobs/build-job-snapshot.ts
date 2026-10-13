// How a build job's snapshot follows the builder (P1 part 6): every
// BuildProgressEvent carries the run's counters, so the snapshot keeps the
// latest status plus the sticky details a UI wants (last check, last seam,
// latest stills) and derives the job's coarse status, label and percent.
// Pure: no I/O, no time of its own.

import type { BuildProgressEvent } from '../tsx-builder/types';
import type {
  BuildPhase,
  TsxBuildJobIpc,
  TsxBuildJobRequestIpc,
  TsxBuildStillIpc,
  TsxJobProgressIpc,
  TsxJobStatus,
} from '@shared/ipc/types';

const PHASE_LABELS: Record<BuildPhase, string> = {
  preparing: 'Preparing',
  working: 'Designing and writing',
  checking: 'Checking',
  rendering: 'Rendering frames',
  saving: 'Saving',
  done: 'Complete',
};

/** Before the first event: what the request already says. */
export function initialBuildSnapshot(request: TsxBuildJobRequestIpc): TsxBuildJobIpc {
  return {
    budget: request.budget,
    edit: Boolean(request.editOf),
    phase: 'preparing',
    round: 0,
    roundsMax: 0,
    checks: 0,
    turns: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    elapsedMs: 0,
    stills: [],
  };
}

/** The job's coarse status for a builder phase; undefined once the run is over (the job decides from its result). */
export function statusForPhase(phase: BuildPhase): TsxJobStatus | undefined {
  if (phase === 'done') return undefined;
  return phase === 'saving' ? 'saving' : 'generating';
}

export function buildProgressPercent(build: TsxBuildJobIpc): number {
  if (build.phase === 'done') return 100;
  if (build.phase === 'saving') return 98;
  const rounds = build.roundsMax > 0 ? build.round / build.roundsMax : 0;
  return Math.min(95, Math.round(5 + rounds * 85));
}

export function buildProgressLabel(build: TsxBuildJobIpc): string {
  const phase = PHASE_LABELS[build.phase];
  if (build.phase === 'done') return phase;
  const rounds = build.roundsMax > 0 ? `Round ${build.round}/${build.roundsMax} · ` : '';
  const stopping = build.stopping ? ` · stopping (${build.stopping === 'cancelled' ? 'cancelled' : 'cap'})` : '';
  return `${rounds}${phase}${stopping}`;
}

export function buildProgress(build: TsxBuildJobIpc): TsxJobProgressIpc {
  return { step: build.phase, label: buildProgressLabel(build), percent: buildProgressPercent(build) };
}

export interface BuildSnapshotUpdate {
  build: TsxBuildJobIpc;
  /** Absent when the event does not move the job's status. */
  status?: TsxJobStatus;
  progress: TsxJobProgressIpc;
}

/** The snapshot after one event. Returns a new object; `prev` is not touched. */
export function applyBuildEvent(prev: TsxBuildJobIpc, event: BuildProgressEvent): BuildSnapshotUpdate {
  const { status } = event;
  const build: TsxBuildJobIpc = {
    ...prev,
    phase: status.phase,
    round: status.round,
    roundsMax: status.roundsMax,
    checks: status.checks,
    turns: status.turns,
    tokens: { ...status.tokens },
    elapsedMs: status.elapsedMs,
  };
  switch (event.type) {
    case 'start':
      build.caps = event.caps;
      build.edit = event.edit;
      break;
    case 'check':
      build.lastCheck = { n: event.n, ok: event.ok, errors: [...event.errors] };
      break;
    case 'stills': {
      const stills: TsxBuildStillIpc[] =
        event.size === 'sheet'
          ? [{ round: status.round, frame: event.frames[0] ?? 0, size: 'sheet', frames: [...event.frames], path: event.paths[0] ?? '' }]
          : event.paths.map((path, i) => ({ round: status.round, frame: event.frames[i] ?? 0, size: event.size, path }));
      build.stills = stills.filter((s) => s.path);
      break;
    }
    case 'seam':
      build.seam = { jump: event.jump, wrap: event.wrap, neighbours: event.neighbours };
      break;
    case 'purity':
      build.purity = { pure: event.pure, frames: [...event.frames], worst: event.worst };
      break;
    case 'asset':
      build.assetsAdded = [...(build.assetsAdded ?? []), ...event.files];
      if (event.source === 'generated') {
        const images = build.images ?? { count: 0, costUsd: 0 };
        build.images = { count: images.count + 1, costUsd: images.costUsd + (event.costUsd ?? 0) };
      }
      break;
    case 'stopping':
      build.stopping = event.reason;
      break;
    case 'done':
      build.stopReason = event.stopReason;
      break;
    case 'phase':
    case 'turn':
      break;
  }
  const next = statusForPhase(build.phase);
  return { build, ...(next ? { status: next } : {}), progress: buildProgress(build) };
}
