// A `build` job (P1 part 6): the TSX builder hosted by the job engine. The
// engine owns the record, its abort controller and the push to the renderer;
// this runs one job from "generating" to its final status. The request is
// plain IPC data (TsxBuildJobRequestIpc); the live parts — the job's signal,
// the progress listener that keeps the snapshot current, the narration
// stream — are made here. The builder saves the version itself (build-store),
// so the job only records where it landed and seeds the project's chat.

import path from 'path';
import { generateTsx } from '../tsx-builder/generate-tsx';
import { craftPacksProblem } from '../tsx-builder/craft-packs';
import { appendChatTurns } from './chat-store';
import { applyBuildEvent, buildProgress } from './build-job-snapshot';
import { logEngine } from '../../../logging/log-engine';
import type { BuildPack, BuildResult, BuildUsageTag, GenerateTsxRequest, StudioShotBuild } from '../tsx-builder/types';
import type {
  TsxBuildJobIpc,
  TsxBuildJobRequestIpc,
  TsxBuildStillIpc,
  TsxJobIpc,
  TsxJobOrigin,
  TsxJobStartRequest,
} from '@shared/ipc/types';

const log = logEngine.createLogger('TsxBuildJob');

/** Narration chunks are flushed this often, like the pipeline's stream. */
export const STREAM_FLUSH_MS = 120;

/**
 * A build started from main by another caller (P3): agents, Studio, flows.
 * Never from the renderer: `into` names a folder to write and `usage` an
 * agent to bill (llm-handlers.ts keeps `agentId` main-only for that reason).
 */
export interface TsxJobOwner {
  origin: Exclude<TsxJobOrigin, 'creator'>;
  /** The empty folder the caller made for a new build (BuildRequest.into). */
  into?: string;
  /** With `into`: a fresh build saved as the folder's next version (Studio's Regenerate). */
  retake?: boolean;
  /** A Studio shot: what its looks show behind it (BuildRequest.studioShot). */
  studioShot?: StudioShotBuild;
  usage?: BuildUsageTag;
  /** Pack texts the caller composes in code (Studio's studio-shot pack), after the request's craft packs. */
  packs?: BuildPack[];
}

export interface BuildJobContext {
  snapshot: TsxJobIpc;
  request: TsxJobStartRequest;
  /** Absent = the Creator (a job started over IPC). */
  owner?: TsxJobOwner;
  abort: AbortController;
  /** Push the snapshot to every listener. */
  emit: () => void;
  /** Live narration for the stream listeners. */
  stream: (chunk: string) => void;
}

/** The start() checks for a build request: the message for the user, or null when it can run. */
export function validateBuildRequest(request: TsxJobStartRequest): string | null {
  const build = request.build;
  if (!build) return 'A build job needs its build settings';
  if (!['quick', 'standard', 'craft'].includes(build.budget)) return `Unknown build budget "${String(build.budget)}"`;
  if (!build.format && !build.editOf) return 'A new build needs a format (width, height, fps)';
  if (build.format && !(build.format.width > 0 && build.format.height > 0 && build.format.fps > 0)) {
    return 'A build format needs a positive width, height and fps';
  }
  // Before anything queues, so a wrong id never reaches the model.
  if (build.packs !== undefined) return craftPacksProblem(build.packs);
  return null;
}

function requestFor(ctx: BuildJobContext, build: TsxBuildJobRequestIpc, onText: (delta: string) => void): GenerateTsxRequest {
  const { request, abort, owner } = ctx;
  return {
    intent: request.prompt,
    ...(owner?.into ? { into: owner.into } : {}),
    ...(owner?.retake ? { retake: true } : {}),
    ...(owner?.studioShot ? { studioShot: owner.studioShot } : {}),
    ...(owner?.usage ? { usage: owner.usage } : {}),
    ...(build.format ? { format: build.format } : {}),
    budget: build.budget,
    ...(build.packs ? { craftPacks: build.packs } : {}),
    ...(build.style?.trim() ? { style: build.style.trim() } : {}),
    ...(owner?.packs?.length ? { packs: owner.packs } : {}),
    ...(build.brand ? { brand: build.brand } : {}),
    ...(build.referenceImages?.length ? { referenceImages: build.referenceImages } : {}),
    ...(build.editOf ? { editOf: build.editOf } : {}),
    ...(build.name ? { name: build.name } : {}),
    ...(request.providerId ? { providerId: request.providerId } : {}),
    ...(request.options?.model ? { model: request.options.model } : {}),
    ...(build.effort ? { effort: build.effort } : {}),
    ...(build.maxMinutes ? { maxMinutes: build.maxMinutes } : {}),
    ...(build.maxOutputTokens ? { maxOutputTokens: build.maxOutputTokens } : {}),
    ...(build.assets?.length ? { assets: build.assets } : {}),
    ...(build.maxGeneratedImages !== undefined ? { maxGeneratedImages: build.maxGeneratedImages } : {}),
    signal: abort.signal,
    onProgress: (event) => {
      const snap = ctx.snapshot;
      const update = applyBuildEvent(snap.build!, event);
      snap.build = update.build;
      if (update.status) snap.status = update.status;
      snap.progress = update.progress;
      ctx.emit();
    },
    onText,
  };
}

/** The result's saved stills as absolute paths (the snapshot's `stills` once done). */
function savedStills(build: BuildResult): TsxBuildStillIpc[] {
  const folder = build.version?.folderPath;
  if (!folder) return [];
  return build.stills.map(({ file, ...still }) => ({ ...still, path: path.join(folder, file) }));
}

function finalBuild(prev: TsxBuildJobIpc, build: BuildResult): TsxBuildJobIpc {
  return {
    ...prev,
    phase: 'done',
    round: build.rounds,
    checks: build.checks,
    turns: build.turns,
    tokens: { ...build.tokens },
    caps: build.caps,
    elapsedMs: build.elapsedMs,
    stopReason: build.stopReason,
    finished: build.finished,
    ...(build.seamOk !== undefined ? { seamOk: build.seamOk } : {}),
    ...(build.pureOk !== undefined ? { pureOk: build.pureOk } : {}),
    ...(build.numbersOk !== undefined ? { numbersOk: build.numbersOk } : {}),
    ...(build.images ? { images: build.images } : {}),
    ...(build.summary ? { summary: build.summary } : {}),
    ...(build.ok && build.error ? { notice: build.error } : {}),
    ...(build.version ? { stills: savedStills(build) } : {}),
  };
}

function usageOf(build: BuildResult): TsxJobIpc['usage'] {
  const input = build.usage?.inputTokens ?? build.tokens.input + build.tokens.cacheRead + build.tokens.cacheCreation;
  const output = build.usage?.outputTokens ?? build.tokens.output;
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}

/**
 * Run the job to its final status. The snapshot's status is already
 * `generating` (set by the engine before any await). Never throws for a
 * builder outcome; an unexpected throw is the engine's to mark.
 */
export async function runBuildJob(ctx: BuildJobContext): Promise<void> {
  const snap = ctx.snapshot;
  const build = ctx.request.build!;
  snap.progress = buildProgress(snap.build!);
  ctx.emit();

  let buffer = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    flushTimer = null;
    if (!buffer) return;
    const chunk = buffer;
    buffer = '';
    ctx.stream(chunk);
  };
  const onText = (delta: string) => {
    buffer += delta;
    if (!flushTimer) flushTimer = setTimeout(flush, STREAM_FLUSH_MS);
  };

  const result = await generateTsx(requestFor(ctx, build, onText));
  if (flushTimer) clearTimeout(flushTimer);
  flush();
  snap.completedAt = Date.now();

  const outcome = result.engine === 'builder' ? result.build : undefined;
  if (outcome) snap.build = finalBuild(snap.build!, outcome);

  if (result.ok && outcome?.version) {
    const { version } = outcome;
    // The project's chat is seeded before `done` goes out, as the pipeline
    // jobs do: a listener that opens the result finds everything on disk.
    const rounds = `${outcome.rounds} round${outcome.rounds === 1 ? '' : 's'}`;
    const ending = outcome.finished ? 'finished' : (outcome.error ?? 'stopped');
    await appendChatTurns(version.folderPath, [
      { role: 'user', content: build.threadText?.trim() || ctx.request.prompt },
      {
        role: 'assistant',
        content: build.editOf
          ? `Applied edit — saved as v${version.number} (${build.budget}, ${rounds}, ${ending}).`
          : `Built v${version.number} (${build.budget}, ${rounds}, ${ending}).`,
        version: version.number,
        ...(outcome.summary ? { summary: outcome.summary } : {}),
      },
    ]).catch(() => {});
    snap.projectName = path.basename(version.folderPath);
    snap.folderPath = version.folderPath;
    snap.versionPath = version.tsxPath;
    snap.usage = usageOf(outcome);
    snap.status = 'done';
    snap.progress = { step: 'done', label: 'Complete', percent: 100 };
    ctx.emit();
    log.info('Build job complete', { id: snap.id, folder: version.folderPath, stopReason: outcome.stopReason });
    return;
  }

  const cancelled = result.stopReason === 'cancelled' || ctx.abort.signal.aborted;
  if (cancelled) {
    snap.status = 'cancelled';
    snap.progress = { step: 'cancelled', label: 'Cancelled', percent: snap.progress.percent };
    log.info('Build job cancelled', { id: snap.id });
  } else {
    snap.status = 'error';
    snap.error = result.error ?? 'Build failed';
    snap.progress = { step: 'error', label: 'Failed', percent: snap.progress.percent };
    log.warn('Build job failed', { id: snap.id, reason: result.reason, error: snap.error });
  }
  ctx.emit();
}
