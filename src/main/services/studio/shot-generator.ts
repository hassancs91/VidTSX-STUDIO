// TSX shot generation (TSX_SHOTS_DESIGN.md D8; on the TSX builder since P3
// part 5). One service behind every entry point: the assistant's
// generate_tsx_shot tool, the media-pool Generate button, and the Inspector's
// Regenerate, Apply edit and Refine — "buttons and chat converge".
//
// Every op is ONE `build` job on the app's job engine (startBuildAndWait), so
// a shot shares the one-build-at-a-time queue, cancel and progress with the
// Creator, agents and flows:
// - generate: a new build `into` the reserved shots/<id>/ (v1);
// - regenerate: a fresh build into the same folder (`retake`), saved as N+1;
// - edit: a builder edit of the active version, at the Inspector's budget;
// - refine: a Quick builder edit that looks and fixes what its frames show.
// The builder's check is the acceptance gate (the shot lint and the literal
// config parse run on its bundle), and the builder saves vN.tsx + vN.src/ +
// vN.stills/ + vN.assets/ itself. What it is asked is shot-build-request.ts;
// the media in, behind and out is shot-build-media.ts.
//
// Cancel: one controller per shot, chained to the caller's signal (an
// assistant turn), so the pool card, the Inspector and a stopped turn all
// stop the same run. A cancelled NEW shot leaves the registry and its empty
// folder is released; a failed new shot stays as an error shot (Regenerate
// builds into its empty folder); a cancelled or failed retake, edit or refine
// leaves the shot as it was.
//
// Main writes ONLY shots/<id>/ files. The registry lives in the renderer's
// document (shots-adopt), so main and the autosave never race on project.json.
// validateShotCode + buildShotEngineDeps stay for conform, import, reconcile
// and package import until the one-shot pipeline goes (P3 part 8).

import path from 'path';
import fs from 'fs/promises';
import type { TsxEngineDeps } from '../../../shared/tsx-engine';
import type {
  BuildBudget,
  StudioShotGenerateOp,
  StudioShotJobEvent,
  TsxBuildJobIpc,
  TsxJobIpc,
  TsxJobStartRequest,
  TsxValidateResponse,
} from '../../../shared/ipc/types';
import type { StudioAgentSettings, StudioClipOrigin, StudioShot, StudioShotKind } from '../../../shared/types/studio';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { sliceAnchorWords, type ShotAnchorWord } from '../../../shared/studio/shot-words';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';
import { reserveProjectFolder } from '../tsx-jobs/project-store';
import { startBuildAndWait } from '../tsx-jobs/build-and-wait';
import { getBuildEngine } from '../tsx-jobs/build-engine';
import type { TsxJobOwner } from '../tsx-jobs/tsx-build-job';
import type { StudioShotBuild } from '../tsx-builder/types';
import { resolveProjectBrand } from './project-brand';
import { resolveShotAssetRefs, type ResolvedShotAssetRefs } from './shot-asset-refs';
import { composeShotStyleMemory } from './agent-memory-prompt';
import { listMemories } from './agent-memory';
import { getShotKitPromptInfo } from './shot-kit';
import { loadProject } from './project-store';
import { shotJobEvents } from './shot-job-events';
import { getProjectDir, getShotVersionPath } from './studio-paths';
import { readTranscriptFile } from './asset-transcriber';
import {
  brandText,
  convertIntent,
  editIntent,
  generateIntent,
  isTransparentKind,
  refineIntent,
  shotBuildRequest,
  shotFormat,
  studioShotPack,
} from './shot-build-request';
import { attachVersionMedia, backdropFor, shotMediaFiles, versionFileKeys, type FootageSource } from './shot-build-media';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ShotGenerator');

/** What a queued shot's card says: builds run one at a time, app-wide (P3 D7). */
export const WAITING_MESSAGE = 'Waiting for another build to finish';

export interface ShotAnchor {
  assetId: string;
  sourceStart: number;
  sourceEnd: number;
}

interface ShotRunOptions {
  providerId?: string;
  /** Shot model (W1); absent = the provider's default. */
  model?: string;
  /** The footage under the shot when it has no anchor (the master clip under the playhead or the clip): its looks show it. */
  footage?: FootageSource;
  signal?: AbortSignal;
  /** Each progress line as the shot's card shows it (the assistant's tool chip). */
  onProgress?: (message: string, percent: number) => void;
}

export interface GenerateShotRequest extends ShotRunOptions {
  projectId: string;
  kind: StudioShotKind;
  brief: string;
  name?: string;
  anchor?: ShotAnchor;
  /** Media inside the shot (D12): key → project asset id or 'library:<relPath>'.
   *  Library values are imported on use; the registry stores project ids. */
  assetRefs?: Record<string, string>;
  durationSeconds?: number;
  /** Default Standard (P3 D11). */
  budget?: BuildBudget;
  origin: StudioClipOrigin;
  /** Fires as soon as the shot folder is reserved (the id exists) — the IPC
   *  handshake returns then, while the build continues detached. */
  onReserved?: (shotId: string) => void;
}

/** What the renderer knows about the shot better than project.json does (the autosave lags). */
interface ShotFacts {
  kind?: StudioShotKind;
  brief?: string;
  anchor?: ShotAnchor;
  assetRefs?: Record<string, string>;
}

export interface EditShotRequest extends ShotRunOptions, ShotFacts {
  projectId: string;
  shotId: string;
  /** The document's activeVersion — the version the instruction applies to. */
  activeVersion: number;
  instruction: string;
  /** Default Standard (Hasan 10-15: the Inspector's budget picker). */
  budget?: BuildBudget;
}

export interface RefineShotRequest extends ShotRunOptions, ShotFacts {
  projectId: string;
  shotId: string;
  /** The document's activeVersion — the version being looked at. */
  activeVersion: number;
}

export interface ConvertShotRequest extends RefineShotRequest {
  /** Why the version is not a Studio shot: the gate's error and the bundler's reason. */
  problems: string[];
}

/** A finished op: the registry entry, and the build that made it (its stills go back to the assistant). */
export interface ShotBuildOutcome {
  shot: StudioShot;
  build?: TsxBuildJobIpc;
}

/** The run was cancelled (pool card, Inspector, or the caller's signal). Not a failure. */
export class ShotCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'ShotCancelledError';
  }
}

type Listener = (event: StudioShotJobEvent) => void;

/** The shot gate (import, conform, reconcile, package import). `syntaxError`: it failed to compile, so Convert is never offered. */
export async function validateShotCode(code: string): Promise<TsxValidateResponse & { syntaxError?: boolean }> {
  const transpile = await validateTsxCode(code);
  if (!transpile.success) return { ...transpile, syntaxError: true };
  const lint = lintShotSource(code);
  if (!lint.ok) return { success: false, error: lint.errors.join(' ') };
  if (parseCompositionConfig(code) === null) {
    return {
      success: false,
      error:
        'compositionConfig could not be parsed — it must be `export const compositionConfig = { ... }` with literal number values only (no expressions, comments are ok).',
    };
  }
  return { success: true };
}

/**
 * The engine deps the one-shot pipeline runs with: the LLM call plus the
 * ACCEPTANCE GATE as `tsxValidate`. Still used by the import service's
 * conform pass (D14) until P3 part 8.
 */
export function buildShotEngineDeps(
  providerId: string | undefined,
  signal?: AbortSignal,
  model?: string,
): TsxEngineDeps {
  return {
    llmGenerate: (req) =>
      runLlmGenerate(
        {
          ...req,
          ...(providerId && !req.providerId ? { providerId } : {}),
          ...(model && !req.model ? { model } : {}),
          featureSource: 'studio-tsx-shot',
        },
        signal,
      ),
    tsxValidate: (req) => validateShotCode(req.code),
  };
}

/** Studio's shot default (W1): the project's provider and its shot model, else its model — what the editor's Generate sends. */
export function shotDefaults(agent: StudioAgentSettings | undefined): { providerId?: string; model?: string } {
  const model = agent?.shotModel || agent?.model;
  return { ...(agent?.providerId ? { providerId: agent.providerId } : {}), ...(model ? { model } : {}) };
}

const runKey = (projectId: string, shotId: string) => `${projectId}:${shotId}`;

function shotConfig(code: string): StudioShot['config'] | undefined {
  const config = parseCompositionConfig(code);
  return config
    ? { durationInFrames: config.durationInFrames, fps: config.fps, width: config.width, height: config.height }
    : undefined;
}

class ShotGeneratorService {
  /** One run per shot: its controller, chained to the caller's signal. */
  private runs = new Map<string, AbortController>();

  onEvent(listener: Listener): () => void {
    return shotJobEvents.onEvent(listener);
  }

  private emit(event: StudioShotJobEvent): void {
    shotJobEvents.emit(event);
  }

  isRunning(projectId: string, shotId: string): boolean {
    return this.runs.has(runKey(projectId, shotId));
  }

  /** Stop the run on a shot, queued or building. False when none is running. */
  cancel(projectId: string, shotId: string): boolean {
    const controller = this.runs.get(runKey(projectId, shotId));
    if (!controller) return false;
    controller.abort();
    return true;
  }

  private track(projectId: string, shotId: string, signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
    const key = runKey(projectId, shotId);
    if (this.runs.has(key)) throw new Error('This shot is already building: wait for it, or cancel it first.');
    const controller = new AbortController();
    const follow = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', follow, { once: true });
    this.runs.set(key, controller);
    return {
      signal: controller.signal,
      done: () => {
        signal?.removeEventListener('abort', follow);
        if (this.runs.get(key) === controller) this.runs.delete(key);
      },
    };
  }

  /** Anchor words re-based to shot-local seconds (D7). Throws when the anchor
   *  has no usable transcript — callers surface that as a tool/IPC error. */
  private async bakeAnchorWords(projectId: string, anchor: ShotAnchor): Promise<ShotAnchorWord[]> {
    const file = await readTranscriptFile(projectId, anchor.assetId);
    if (!file?.words || file.words.length === 0) {
      throw new Error(
        `Asset ${anchor.assetId} has no word-level transcript — transcribe it first (word sync needs word timestamps).`,
      );
    }
    const words = sliceAnchorWords(file.words, anchor.sourceStart, anchor.sourceEnd);
    if (words.length === 0) {
      throw new Error(
        `No transcript words inside ${anchor.sourceStart.toFixed(2)}–${anchor.sourceEnd.toFixed(2)} s — check the span against the transcript.`,
      );
    }
    return words;
  }

  /** Q6a: the project's learned style (brand-filtered rules + profile). A memory failure never blocks a build. */
  private async learnedStyle(projectId: string, brandId?: string): Promise<{ rules: string[]; profile?: string } | undefined> {
    try {
      const composed = composeShotStyleMemory(await listMemories(), { ...(brandId ? { brandId } : {}) });
      if (composed.droppedProfile || composed.rulesOverflowBy > 0) {
        log.warn('Shot style memory over budget', { projectId, droppedProfile: composed.droppedProfile, rulesOverflowBy: composed.rulesOverflowBy });
      }
      return composed.styleMemory ?? undefined;
    } catch (error) {
      log.warn('Shot style memory read failed — building without it', { error: String(error) });
      return undefined;
    }
  }

  /** D11: the project's brand as the builder's BRAND text. A stale brandId degrades to none. */
  private async brandFor(projectId: string, brandId: string | undefined, kind: StudioShotKind): Promise<string | undefined> {
    const brand = await resolveProjectBrand(projectId, brandId);
    if (brandId && !brand) log.warn('Project brandId has no matching brand — building unbranded', { projectId, brandId });
    return brand ? brandText(brand, kind) : undefined;
  }

  /**
   * One build job, start to end. Progress becomes shot events (the queued
   * line says it waits for another build); `entry` rides each one for a new
   * shot, so the pool shows it while it builds. Resolves with the done job;
   * throws ShotCancelledError on a cancel, an Error on a failure.
   */
  private async runBuild(input: {
    projectId: string;
    shotId: string;
    op: StudioShotGenerateOp;
    request: TsxJobStartRequest;
    owner: TsxJobOwner;
    signal: AbortSignal;
    entry?: StudioShot;
    onProgress?: (message: string, percent: number) => void;
  }): Promise<TsxJobIpc & { versionPath: string }> {
    let last = '';
    const awaited = await startBuildAndWait(await getBuildEngine(), input.request, {
      owner: input.owner,
      signal: input.signal,
      onJob: (job) => {
        if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') return;
        const message = job.status === 'queued' ? WAITING_MESSAGE : job.progress.label;
        const percent = Math.round(job.progress.percent);
        if (`${message}|${percent}` === last) return;
        last = `${message}|${percent}`;
        this.emit({
          projectId: input.projectId,
          shotId: input.shotId,
          op: input.op,
          status: 'generating',
          percent,
          message,
          ...(input.entry ? { shot: input.entry } : {}),
        });
        try {
          input.onProgress?.(message, percent);
        } catch {
          /* a listener must not break the run */
        }
      },
    });
    const job = awaited.final;
    if (input.signal.aborted || job?.status === 'cancelled') throw new ShotCancelledError();
    if (awaited.startError || !job) throw new Error(awaited.startError ?? 'The build did not start.');
    if (job.status === 'done' && job.versionPath) return { ...job, versionPath: job.versionPath };
    throw new Error(job.error ?? 'The build failed.');
  }

  /**
   * Generate a new shot (op 'generate') or a fresh take of an existing one
   * (op 'regenerate': same folder, next version). Resolves with the registry
   * entry; rejects AFTER emitting the cancel or error event, so both awaiting
   * callers and event listeners see it. A failure before the folder exists
   * (no transcript for the anchor, a bad asset ref) rejects with no event.
   */
  async generate(req: GenerateShotRequest, existingShotId?: string): Promise<ShotBuildOutcome> {
    const op: StudioShotGenerateOp = existingShotId ? 'regenerate' : 'generate';
    // A retake is tracked from the start: its shot id is known.
    let run = existingShotId ? this.track(req.projectId, existingShotId, req.signal) : null;
    try {
      const project = await loadProject(req.projectId);
      const durationSeconds =
        req.durationSeconds ?? (req.anchor ? req.anchor.sourceEnd - req.anchor.sourceStart : undefined) ?? 5;
      if (!(durationSeconds > 0)) throw new Error('Shot duration must be positive');
      const words = req.anchor ? await this.bakeAnchorWords(req.projectId, req.anchor) : undefined;
      // D12: resolve asset refs BEFORE reserving the folder — a bad ref fails
      // fast and never leaves a half-born shot. Library refs import on use.
      let resolved: ResolvedShotAssetRefs | undefined;
      if (req.assetRefs && Object.keys(req.assetRefs).length > 0) resolved = await resolveShotAssetRefs(project, req.assetRefs);
      const brandId = project.settings.brandId;
      const [brand, style, kit] = await Promise.all([
        this.brandFor(req.projectId, brandId, req.kind),
        this.learnedStyle(req.projectId, brandId),
        getShotKitPromptInfo(),
      ]);
      const transparent = isTransparentKind(req.kind);
      const footage = req.anchor ? { assetId: req.anchor.assetId, sourceSeconds: req.anchor.sourceStart } : req.footage;
      const backdrop = transparent && footage ? await backdropFor(req.projectId, project, footage) : undefined;

      let shotId: string;
      let folderPath: string;
      if (existingShotId) {
        shotId = existingShotId;
        folderPath = path.dirname(await getShotVersionPath(req.projectId, shotId, 1));
      } else {
        const shotsDir = path.join(await getProjectDir(req.projectId), 'shots');
        const reserved = await reserveProjectFolder(req.name ?? req.brief.slice(0, 40), shotsDir);
        shotId = reserved.name;
        folderPath = reserved.folderPath;
        run = this.track(req.projectId, shotId, req.signal);
      }
      req.onReserved?.(shotId);

      const entry: StudioShot = {
        id: shotId,
        name: req.name ?? shotId,
        kind: req.kind,
        createdAt: new Date().toISOString(),
        activeVersion: 1,
        status: 'generating',
        ...(req.anchor ? { anchor: req.anchor } : {}),
        ...(resolved ? { assetRefs: resolved.refs } : {}),
        prompt: req.brief,
        origin: req.origin,
      };
      // A retake leaves the registry alone until it is ready.
      const shown = existingShotId ? undefined : entry;
      this.emit({
        projectId: req.projectId,
        shotId,
        op,
        status: 'generating',
        percent: 0,
        message: 'Starting…',
        ...(shown ? { shot: shown } : {}),
        // Library files imported on use ride the FIRST event so the renderer
        // adopts them into project.assets before the shot could ever serialize.
        ...(resolved && resolved.imported.length > 0 ? { importedAssets: resolved.imported } : {}),
      });

      const assetsById = new Map([...project.assets, ...(resolved?.imported ?? [])].map((a) => [a.id, a] as const));
      const media = resolved ? shotMediaFiles(resolved.refs, assetsById) : { assets: [], notes: [] };
      const request = shotBuildRequest({
        prompt: generateIntent({
          kind: req.kind,
          brief: req.brief,
          durationSeconds,
          ...(words ? { words } : {}),
          ...(style ? { style } : {}),
          ...(media.notes.length ? { media: media.notes } : {}),
        }),
        threadText: req.brief,
        budget: req.budget ?? 'standard',
        pack: studioShotPack(kit),
        format: shotFormat(project.settings, durationSeconds),
        ...(brand ? { brand } : {}),
        ...(media.assets.length ? { assets: media.assets } : {}),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        ...(req.model ? { model: req.model } : {}),
      });
      const studioShot: StudioShotBuild = { transparent, ...(backdrop ? { backdrop } : {}) };

      try {
        const job = await this.runBuild({
          projectId: req.projectId,
          shotId,
          op,
          request,
          owner: {
            origin: 'studio',
            into: folderPath,
            ...(existingShotId ? { retake: true } : {}),
            usage: { featureSource: 'studio-tsx-shot' },
            studioShot,
          },
          signal: run!.signal,
          ...(shown ? { entry: shown } : {}),
          ...(req.onProgress ? { onProgress: req.onProgress } : {}),
        });
        const code = await fs.readFile(job.versionPath, 'utf-8');
        const attached = await attachVersionMedia(req.projectId, job.versionPath, code, resolved?.refs ?? {});
        const assetRefs = { ...(resolved?.refs ?? {}), ...(attached?.assetRefs ?? {}) };
        const config = shotConfig(code);
        const { assetRefs: _requested, ...rest } = entry;
        const shot: StudioShot = {
          ...rest,
          activeVersion: versionOf(job.versionPath),
          status: 'ready',
          ...(config ? { config } : {}),
          ...(Object.keys(assetRefs).length > 0 ? { assetRefs } : {}),
        };
        this.emit({
          projectId: req.projectId,
          shotId,
          op,
          status: 'ready',
          shot,
          ...(attached && attached.assets.length > 0 ? { importedAssets: attached.assets } : {}),
        });
        return { shot, ...(job.build ? { build: job.build } : {}) };
      } catch (err) {
        if (err instanceof ShotCancelledError) {
          this.emit({ projectId: req.projectId, shotId, op, status: 'canceled' });
          // A cancelled new shot leaves no trace: its folder is still empty (a cancelled build saves nothing).
          if (!existingShotId) await fs.rmdir(folderPath).catch(() => {});
          log.info('Shot build cancelled', { projectId: req.projectId, shotId, op });
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Shot generation failed';
        // A failed new shot stays as an error shot (Regenerate builds into its empty folder); a failed retake leaves the shot as it was.
        this.emit({
          projectId: req.projectId,
          shotId,
          op,
          status: 'error',
          error: message,
          ...(shown ? { shot: { ...shown, status: 'error', error: message } } : {}),
        });
        log.error('Shot generation failed', err, { projectId: req.projectId, shotId, op });
        throw err instanceof Error ? err : new Error(message);
      }
    } finally {
      run?.done();
    }
  }

  /** Edit round-trip (D9): instruction → the builder edits the active version → the next version. */
  async edit(req: EditShotRequest): Promise<ShotBuildOutcome> {
    return this.editVersion(req, 'edit', req.budget ?? 'standard', (facts) =>
      editIntent({ kind: facts.kind, instruction: req.instruction, ...(facts.media.length ? { media: facts.media } : {}) }),
    req.instruction);
  }

  /** Refine (Q5): a Quick builder edit that looks at the active version and fixes only what its frames show. */
  async refine(req: RefineShotRequest): Promise<ShotBuildOutcome> {
    return this.editVersion(
      req,
      'refine',
      'quick',
      (facts) =>
        refineIntent({
          kind: facts.kind,
          ...(facts.brief ? { brief: facts.brief } : {}),
          ...(facts.styleRules.length ? { styleRules: facts.styleRules } : {}),
          ...(facts.media.length ? { media: facts.media } : {}),
        }),
      `Refine v${req.activeVersion}`,
    );
  }

  /**
   * Convert for Studio (P3 part 8, D10): a Quick builder edit that makes a
   * version written outside Studio pass the shot check, as the next version.
   * Its events are op 'import' (the renderer adopts its snapshot whole).
   */
  async convert(req: ConvertShotRequest): Promise<ShotBuildOutcome> {
    return this.editVersion(
      req,
      'import',
      'quick',
      (facts) => convertIntent({ problems: req.problems, ...(facts.media.length ? { media: facts.media } : {}) }),
      `Convert v${req.activeVersion} for Studio`,
    );
  }

  private async editVersion(
    req: RefineShotRequest,
    op: 'edit' | 'refine' | 'import',
    budget: BuildBudget,
    intent: (facts: { kind: StudioShotKind; brief?: string; styleRules: string[]; media: ReturnType<typeof shotMediaFiles>['notes'] }) => string,
    threadText: string,
  ): Promise<ShotBuildOutcome> {
    const run = this.track(req.projectId, req.shotId, req.signal);
    // Everything after the track reports as an event: the IPC handshake has already returned.
    try {
      const versionPath = await getShotVersionPath(req.projectId, req.shotId, req.activeVersion);
      await fs.access(versionPath).catch(() => {
        throw new Error(`v${req.activeVersion} of shot ${req.shotId} is missing on disk.`);
      });
      const folderPath = path.dirname(versionPath);
      const project = await loadProject(req.projectId);
      const stored = project.shots.find((s) => s.id === req.shotId);
      const kind = req.kind ?? stored?.kind ?? 'overlay';
      const anchor = req.anchor ?? stored?.anchor;
      const refs = req.assetRefs ?? stored?.assetRefs ?? {};
      const brandId = project.settings.brandId;
      const [brand, style, kit, have] = await Promise.all([
        this.brandFor(req.projectId, brandId, kind),
        op === 'refine' ? this.learnedStyle(req.projectId, brandId) : Promise.resolve(undefined),
        getShotKitPromptInfo(),
        versionFileKeys(folderPath),
      ]);
      const transparent = isTransparentKind(kind);
      const footage = anchor ? { assetId: anchor.assetId, sourceSeconds: anchor.sourceStart } : req.footage;
      const backdrop = transparent && footage ? await backdropFor(req.projectId, project, footage) : undefined;
      // The shot's media the seeded version does not carry already (a shot made before the builder).
      const media = shotMediaFiles(refs, new Map(project.assets.map((a) => [a.id, a] as const)), have);
      const brief = req.brief ?? stored?.prompt;

      this.emit({
        projectId: req.projectId,
        shotId: req.shotId,
        op,
        status: 'generating',
        percent: 0,
        message: op === 'refine' ? 'Refining…' : op === 'import' ? 'Converting…' : 'Editing…',
      });
      const request = shotBuildRequest({
        prompt: intent({ kind, ...(brief ? { brief } : {}), styleRules: style?.rules ?? [], media: media.notes }),
        threadText,
        budget,
        pack: studioShotPack(kit),
        editOf: { folderPath, version: req.activeVersion },
        ...(brand ? { brand } : {}),
        ...(media.assets.length ? { assets: media.assets } : {}),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        ...(req.model ? { model: req.model } : {}),
      });

      const job = await this.runBuild({
        projectId: req.projectId,
        shotId: req.shotId,
        op,
        request,
        owner: {
          origin: 'studio',
          usage: { featureSource: 'studio-tsx-shot' },
          studioShot: { transparent, ...(backdrop ? { backdrop } : {}) },
        },
        signal: run.signal,
        ...(req.onProgress ? { onProgress: req.onProgress } : {}),
      });
      const code = await fs.readFile(job.versionPath, 'utf-8');
      const attached = await attachVersionMedia(req.projectId, job.versionPath, code, refs);
      const config = shotConfig(code);
      const assetRefs = { ...refs, ...(attached?.assetRefs ?? {}) };
      // An 'import' snapshot is adopted whole (status, version, refs): it carries every ref the shot keeps.
      const carriesRefs = op === 'import' || (attached !== null && Object.keys(attached.assetRefs).length > 0);
      const shot: StudioShot = {
        // Partial snapshot: the renderer merges version, config and new
        // media keys onto its registry entry — name/kind/anchor stay whatever the document says.
        id: req.shotId,
        name: stored?.name ?? req.shotId,
        kind,
        createdAt: new Date().toISOString(),
        activeVersion: versionOf(job.versionPath),
        status: 'ready',
        ...(config ? { config } : {}),
        ...(carriesRefs && Object.keys(assetRefs).length > 0 ? { assetRefs } : {}),
      };
      this.emit({
        projectId: req.projectId,
        shotId: req.shotId,
        op,
        status: 'ready',
        shot,
        ...(attached && attached.assets.length > 0 ? { importedAssets: attached.assets } : {}),
      });
      return { shot, ...(job.build ? { build: job.build } : {}) };
    } catch (err) {
      if (err instanceof ShotCancelledError) {
        // A user cancel is not a failure: no error toast, the version stays.
        this.emit({ projectId: req.projectId, shotId: req.shotId, op, status: 'canceled' });
        log.info(`Shot ${op} cancelled`, { projectId: req.projectId, shotId: req.shotId });
        throw err;
      }
      const message = err instanceof Error ? err.message : `Shot ${op} failed`;
      this.emit({ projectId: req.projectId, shotId: req.shotId, op, status: 'error', error: message });
      log.error(`Shot ${op} failed`, err, { projectId: req.projectId, shotId: req.shotId });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      run.done();
    }
  }
}

function versionOf(versionPath: string): number {
  return Number(/v(\d+)\.tsx$/i.exec(path.basename(versionPath))?.[1]);
}

export const shotGenerator = new ShotGeneratorService();
