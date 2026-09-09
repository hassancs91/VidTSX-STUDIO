// TSX shot generation service (TSX_SHOTS_DESIGN.md D8, plus D7 word bake).
// One service behind BOTH entry points — the agent's generate_tsx_shot tool
// and the media-pool Generate button — "buttons and chat converge".
//
// It drives the shared tsx-engine pipelines with main-process deps, the
// Creator pattern (tsx-job-engine), plus the shot ACCEPTANCE GATE injected as
// the pipeline's `tsxValidate` dep: esbuild transpile + the react/remotion-
// only single-file import lint + a compositionConfig PARSE check. Folding the
// two extra checks into the validate dep is what makes a lint or config
// failure a fix-loop error the pipeline repairs — never a latent export
// failure, and never the parser's silent 300-frame default.
//
// Main writes ONLY shots/<id>/ files. The registry lives in the renderer's
// document (shots-adopt), so main and the autosave never race on project.json.

import path from 'path';
import fs from 'fs/promises';
import {
  generateTsxPipeline,
  editTsxPipeline,
  type TsxEngineDeps,
  type TsxPipelineResult,
} from '../../../shared/tsx-engine';
import type {
  StudioShotGenerateOp,
  StudioShotJobEvent,
  TsxValidateResponse,
} from '../../../shared/ipc/types';
import type { StudioClipOrigin, StudioShot, StudioShotKind } from '../../../shared/types/studio';
import type { StudioBrand } from '../../../shared/types/asset-library';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { buildShotExtraInstructions, buildRefineInstruction } from '../../../shared/studio/shot-prompt';
import { sliceAnchorWords, type ShotAnchorWord } from '../../../shared/studio/shot-words';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';
import {
  reserveProjectFolder,
  writeNextVersion,
  writeDebugSidecar,
  describeSystemPrompt,
} from '../tsx-jobs/project-store';
import { readChatHistory, appendChatTurns, CHAT_CONTEXT_LIMIT } from '../tsx-jobs/chat-store';
import { resolveProjectBrand } from './project-brand';
import { resolveShotAssetRefs, type ResolvedShotAssetRefs } from './shot-asset-refs';
import { composeShotStyleMemory, type ShotStyleMemory } from './agent-memory-prompt';
import { listMemories } from './agent-memory';
import { renderShotStills } from './shot-stills';
import type { LlmImageIpc } from '../../../shared/ipc/types/llm';
import { getShotExemplars } from './shot-exemplars';
import { ensureProjectKitSnapshot, shotUsesKit } from './shot-kit-pin';
import { getShotKitPromptInfo } from './shot-kit';
import { loadProject } from './project-store';
import { shotJobEvents } from './shot-job-events';
import { getProjectDir, getShotVersionPath } from './studio-paths';
import { readTranscriptFile } from './asset-transcriber';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ShotGenerator');

/** Same cap as the Creator's job engine — bulk passes run ~4 wide. */
const MAX_CONCURRENT = 4;

export interface ShotAnchor {
  assetId: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface GenerateShotRequest {
  projectId: string;
  kind: StudioShotKind;
  brief: string;
  name?: string;
  anchor?: ShotAnchor;
  /** Media inside the shot (D12): key → project asset id or 'library:<relPath>'.
   *  Library values are imported on use; the registry stores project ids. */
  assetRefs?: Record<string, string>;
  durationSeconds?: number;
  providerId?: string;
  /** Shot model (W1); absent = the provider's default. */
  model?: string;
  origin: StudioClipOrigin;
  signal?: AbortSignal;
  /** Fires as soon as the shot folder is reserved (the id exists) — the IPC
   *  handshake returns then, while the pipeline continues detached. */
  onReserved?: (shotId: string) => void;
}

export interface EditShotRequest {
  projectId: string;
  shotId: string;
  /** The document's activeVersion — the code the instruction applies to. */
  activeVersion: number;
  instruction: string;
  providerId?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface RefineShotRequest {
  projectId: string;
  shotId: string;
  /** The document's activeVersion — the version being critiqued. */
  activeVersion: number;
  providerId?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface RegenerateShotRequest extends GenerateShotRequest {
  shotId: string;
}

type Listener = (event: StudioShotJobEvent) => void;

/** The gate composed into the pipeline's validate dep (see file header). */
export async function validateShotCode(code: string): Promise<TsxValidateResponse> {
  const transpile = await validateTsxCode(code);
  if (!transpile.success) return transpile;
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
 * The engine deps every shot pipeline runs with: the LLM call plus the
 * ACCEPTANCE GATE as `tsxValidate`. Exported because the import service's
 * conform pass (D14) must be validated by the very same gate — one definition
 * of "acceptable shot code", whether it was generated or imported.
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
          // The project's shot model (W1) — every pipeline step of a shot
          // runs on it unless the step named one itself.
          ...(model && !req.model ? { model } : {}),
          featureSource: 'studio-tsx-shot',
        },
        signal,
      ),
    tsxValidate: (req) => validateShotCode(req.code),
  };
}

class ShotGeneratorService {
  private running = 0;
  private waiters: Array<() => void> = [];

  onEvent(listener: Listener): () => void {
    return shotJobEvents.onEvent(listener);
  }

  private emit(event: StudioShotJobEvent): void {
    shotJobEvents.emit(event);
  }

  private async acquireSlot(): Promise<void> {
    if (this.running < MAX_CONCURRENT) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.running++;
  }

  private releaseSlot(): void {
    this.running--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private buildDeps(
    providerId: string | undefined,
    signal?: AbortSignal,
    model?: string,
  ): TsxEngineDeps {
    return buildShotEngineDeps(providerId, signal, model);
  }

  /** Anchor words re-based to shot-local seconds (D7). Throws when the anchor
   *  has no usable transcript — callers surface that as a tool/IPC error. */
  private async bakeAnchorWords(
    projectId: string,
    anchor: ShotAnchor,
  ): Promise<ShotAnchorWord[]> {
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

  /**
   * Generate a new shot (op 'generate') or a fresh take of an existing one
   * (op 'regenerate' — same folder, next version). Resolves with the
   * registry-shaped entry; rejects on pipeline/gate failure AFTER emitting
   * the error event, so both awaiting callers and event listeners see it.
   */
  async generate(req: GenerateShotRequest, existingShotId?: string): Promise<StudioShot> {
    const op: StudioShotGenerateOp = existingShotId ? 'regenerate' : 'generate';
    const project = await loadProject(req.projectId);
    const { width, height, fps } = project.settings;

    const durationSeconds =
      req.durationSeconds ??
      (req.anchor ? req.anchor.sourceEnd - req.anchor.sourceStart : undefined) ??
      5;
    if (!(durationSeconds > 0)) throw new Error('Shot duration must be positive');

    const words = req.anchor ? await this.bakeAnchorWords(req.projectId, req.anchor) : undefined;

    // D12: resolve asset refs BEFORE reserving the folder — a bad ref (unknown
    // id, missing library file, audio) fails fast with a pointed error and
    // never leaves a half-born shot. Library refs import on use here.
    let resolvedRefs: ResolvedShotAssetRefs | undefined;
    if (req.assetRefs && Object.keys(req.assetRefs).length > 0) {
      resolvedRefs = await resolveShotAssetRefs(project, req.assetRefs);
    }

    // D11: the project's active brand rides every generate/regenerate as a
    // mandatory style contract — read from project.json like width/height/fps,
    // so the agent tool and the pool button both get it with no plumbing. A
    // stale brandId (brand deleted) degrades to no brand, never a hard
    // failure. Edits have no prompt-context channel; "apply the (new) brand
    // to an existing shot" IS regenerate.
    const brandId = project.settings.brandId;
    // Q7f: falls back to <project>/brand.json when the project keeps an
    // imported package's tokens project-local instead of adopting a brand.
    const brand = await resolveProjectBrand(req.projectId, brandId);

    // Q6a: learned style rides every generate/regenerate beside the brand
    // contract — brand-filtered rule/profile memories, budgeted. Store read
    // degrades to none; a memory failure never blocks generation.
    let styleMemory: ShotStyleMemory | null = null;
    try {
      const composed = composeShotStyleMemory(await listMemories(), {
        ...(brandId ? { brandId } : {}),
      });
      styleMemory = composed.styleMemory;
      if (composed.droppedProfile || composed.rulesOverflowBy > 0) {
        log.warn('Shot style memory over budget', {
          projectId: req.projectId,
          droppedProfile: composed.droppedProfile,
          rulesOverflowBy: composed.rulesOverflowBy,
        });
      }
    } catch (error) {
      log.warn('Shot style memory read failed — generating without it', { error: String(error) });
    }

    // Q3a: built-in exemplars of this kind ride every generate/regenerate as
    // the quality bar. Loader degrades to [] — never blocks generation.
    const exemplars = await getShotExemplars(req.kind);
    // Q4: the kit manifest rides as the component API. Degrades to null —
    // the prompt then omits the KIT section and keeps the react+remotion rule.
    const kit = await getShotKitPromptInfo();
    if (brandId && !brand) {
      log.warn('Project brandId has no matching brand — generating unbranded', {
        projectId: req.projectId,
        brandId,
      });
    }

    // Reserve the folder (new shots) BEFORE any LLM work so the id exists
    // for progress events; regenerate reuses the existing folder.
    const projectDir = await getProjectDir(req.projectId);
    const shotsDir = path.join(projectDir, 'shots');
    let shotId: string;
    let folderPath: string;
    if (existingShotId) {
      shotId = existingShotId;
      folderPath = path.dirname(await getShotVersionPath(req.projectId, shotId, 1));
    } else {
      const reserved = await reserveProjectFolder(req.name ?? req.brief.slice(0, 40), shotsDir);
      shotId = reserved.name;
      folderPath = reserved.folderPath;
    }
    req.onReserved?.(shotId);

    const name = req.name ?? shotId;
    const provisional: StudioShot = {
      id: shotId,
      name,
      kind: req.kind,
      createdAt: new Date().toISOString(),
      activeVersion: 1,
      status: 'generating',
      ...(req.anchor ? { anchor: req.anchor } : {}),
      ...(resolvedRefs ? { assetRefs: resolvedRefs.refs } : {}),
      prompt: req.brief,
      origin: req.origin,
    };
    this.emit({
      projectId: req.projectId,
      shotId,
      op,
      status: 'generating',
      percent: 0,
      message: 'Starting…',
      shot: provisional,
      // Library files imported on use ride the FIRST event so the renderer
      // adopts them into project.assets before the shot could ever serialize.
      ...(resolvedRefs && resolvedRefs.imported.length > 0
        ? { importedAssets: resolvedRefs.imported }
        : {}),
    });

    await this.acquireSlot();
    try {
      const result = await generateTsxPipeline(
        {
          prompt: req.brief,
          promptContext: {
            videoWidth: width,
            videoHeight: height,
            fps,
            durationSeconds,
            extraInstructions: buildShotExtraInstructions({
              kind: req.kind,
              width,
              height,
              fps,
              durationSeconds,
              ...(words ? { words } : {}),
              ...(brand ? { brand } : {}),
              ...(resolvedRefs ? { assets: resolvedRefs.promptAssets } : {}),
              ...(exemplars.length > 0 ? { exemplars } : {}),
              ...(kit ? { kit } : {}),
              ...(styleMemory ? { styleMemory } : {}),
            }),
          },
          mode: '2d',
          ...(req.providerId ? { providerId: req.providerId } : {}),
          onProgress: (p) =>
            this.emit({
              projectId: req.projectId,
              shotId,
              op,
              status: 'generating',
              percent: p.percent,
              message: p.stepLabel,
              shot: provisional,
            }),
        },
        this.buildDeps(req.providerId, req.signal, req.model),
      );

      if (req.signal?.aborted) throw new Error('Cancelled');
      if (!result.transpileValid) {
        throw new Error(
          'The generated shot never passed validation (transpile + import lint + config parse) — try a simpler brief or run it again.',
        );
      }

      const shot = await this.saveVersion(req.projectId, folderPath, provisional, result, req.brief);
      this.emit({ projectId: req.projectId, shotId, op, status: 'ready', shot });
      return shot;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shot generation failed';
      const failed: StudioShot = { ...provisional, status: 'error', error: message };
      this.emit({ projectId: req.projectId, shotId, op, status: 'error', error: message, shot: failed });
      log.error('Shot generation failed', err, { projectId: req.projectId, shotId });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      this.releaseSlot();
    }
  }

  /** Edit round-trip (D9): instruction → next version in the same folder. */
  async edit(req: EditShotRequest): Promise<StudioShot> {
    const versionPath = await getShotVersionPath(req.projectId, req.shotId, req.activeVersion);
    const currentCode = await fs.readFile(versionPath, 'utf-8');
    const folderPath = path.dirname(versionPath);

    this.emit({
      projectId: req.projectId,
      shotId: req.shotId,
      op: 'edit',
      status: 'generating',
      percent: 0,
      message: 'Editing…',
    });

    await this.acquireSlot();
    try {
      const chatHistory = (await readChatHistory(folderPath))
        .slice(-CHAT_CONTEXT_LIMIT)
        .map(({ role, content }) => ({ role, content }));
      const result = await editTsxPipeline(
        {
          currentCode,
          editInstruction: req.instruction,
          ...(req.providerId ? { providerId: req.providerId } : {}),
          ...(chatHistory.length > 0 ? { chatHistory } : {}),
          onProgress: (p) =>
            this.emit({
              projectId: req.projectId,
              shotId: req.shotId,
              op: 'edit',
              status: 'generating',
              percent: p.percent,
              message: p.stepLabel,
            }),
        },
        this.buildDeps(req.providerId, req.signal, req.model),
      );

      if (req.signal?.aborted) throw new Error('Cancelled');
      if (!result.transpileValid) {
        throw new Error('The edited shot never passed validation — the previous version is untouched.');
      }

      const newVersionPath = await writeNextVersion(folderPath, result.text);
      const version = Number(/v(\d+)\.tsx$/.exec(path.basename(newVersionPath))?.[1]);
      await this.writeSidecarAndChat(newVersionPath, folderPath, result, req.instruction);
      await this.pinKitIfUsed(req.projectId, result.text);

      const config = parseCompositionConfig(result.text);
      const shot: StudioShot = {
        // Partial snapshot: the renderer merges version+config onto its
        // registry entry — name/kind/anchor stay whatever the document says.
        id: req.shotId,
        name: req.shotId,
        kind: 'overlay',
        createdAt: new Date().toISOString(),
        activeVersion: version,
        status: 'ready',
        ...(config
          ? {
              config: {
                durationInFrames: config.durationInFrames,
                fps: config.fps,
                width: config.width,
                height: config.height,
              },
            }
          : {}),
      };
      this.emit({ projectId: req.projectId, shotId: req.shotId, op: 'edit', status: 'ready', shot });
      return shot;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shot edit failed';
      this.emit({ projectId: req.projectId, shotId: req.shotId, op: 'edit', status: 'error', error: message });
      log.error('Shot edit failed', err, { projectId: req.projectId, shotId: req.shotId });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      this.releaseSlot();
    }
  }

  /** Refine round-trip (Q5): render stills of the current version, send them
   *  with the brief + brand contract through ONE critique-and-revise edit
   *  pass. User-triggered, capped at one round per click by construction. */
  async refine(req: RefineShotRequest): Promise<StudioShot> {
    const versionPath = await getShotVersionPath(req.projectId, req.shotId, req.activeVersion);
    const currentCode = await fs.readFile(versionPath, 'utf-8');
    const folderPath = path.dirname(versionPath);
    const progress = (percent: number, message: string) =>
      this.emit({
        projectId: req.projectId,
        shotId: req.shotId,
        op: 'refine',
        status: 'generating',
        percent,
        message,
      });

    try {
      progress(0, 'Rendering stills…');
      // Stills ride the bundler/still renderer, not the LLM slot — render
      // them before queueing for a pipeline slot.
      const project = await loadProject(req.projectId);
      const shot = project.shots.find((s) => s.id === req.shotId);
      const stills = await renderShotStills(req.projectId, req.shotId, 3);
      const images: LlmImageIpc[] = [];
      for (const stillPath of stills.paths) {
        images.push({
          data: (await fs.readFile(stillPath)).toString('base64'),
          mediaType: 'image/jpeg',
        });
      }

      const brandId = project.settings.brandId;
      const brand = await resolveProjectBrand(req.projectId, brandId);
      let styleRules: string[] = [];
      try {
        styleRules =
          composeShotStyleMemory(await listMemories(), { ...(brandId ? { brandId } : {}) })
            .styleMemory?.rules ?? [];
      } catch {
        // Refine without learned style rather than not at all.
      }
      const instruction = buildRefineInstruction({
        frames: stills.frames,
        fps: shot?.config?.fps ?? project.settings.fps,
        ...(shot?.prompt ? { brief: shot.prompt } : {}),
        ...(brand ? { brand } : {}),
        styleRules,
      });

      progress(30, 'Critiquing…');
      await this.acquireSlot();
      try {
        const chatHistory = (await readChatHistory(folderPath))
          .slice(-CHAT_CONTEXT_LIMIT)
          .map(({ role, content }) => ({ role, content }));
        const result = await editTsxPipeline(
          {
            currentCode,
            editInstruction: instruction,
            images,
            ...(req.providerId ? { providerId: req.providerId } : {}),
            ...(chatHistory.length > 0 ? { chatHistory } : {}),
            onProgress: (p) => progress(30 + Math.round(p.percent * 0.7), p.stepLabel),
          },
          this.buildDeps(req.providerId, req.signal, req.model),
        );

        if (req.signal?.aborted) throw new Error('Cancelled');
        if (!result.transpileValid) {
          throw new Error('The refined shot never passed validation — the previous version is untouched.');
        }

        const newVersionPath = await writeNextVersion(folderPath, result.text);
        const version = Number(/v(\d+)\.tsx$/.exec(path.basename(newVersionPath))?.[1]);
        await this.writeSidecarAndChat(
          newVersionPath,
          folderPath,
          result,
          `Refine pass — stills critique of v${req.activeVersion} (frames ${stills.frames.join(', ')})`,
        );
        await this.pinKitIfUsed(req.projectId, result.text);

        const config = parseCompositionConfig(result.text);
        const refined: StudioShot = {
          // Partial snapshot, exactly like edit(): the renderer merges
          // version+config onto its registry entry.
          id: req.shotId,
          name: req.shotId,
          kind: 'overlay',
          createdAt: new Date().toISOString(),
          activeVersion: version,
          status: 'ready',
          ...(config
            ? {
                config: {
                  durationInFrames: config.durationInFrames,
                  fps: config.fps,
                  width: config.width,
                  height: config.height,
                },
              }
            : {}),
        };
        this.emit({ projectId: req.projectId, shotId: req.shotId, op: 'refine', status: 'ready', shot: refined });
        return refined;
      } finally {
        this.releaseSlot();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shot refine failed';
      this.emit({ projectId: req.projectId, shotId: req.shotId, op: 'refine', status: 'error', error: message });
      log.error('Shot refine failed', err, { projectId: req.projectId, shotId: req.shotId });
      throw err instanceof Error ? err : new Error(message);
    }
  }

  private async saveVersion(
    projectId: string,
    folderPath: string,
    provisional: StudioShot,
    result: TsxPipelineResult,
    brief: string,
  ): Promise<StudioShot> {
    const versionPath = await writeNextVersion(folderPath, result.text);
    const version = Number(/v(\d+)\.tsx$/.exec(path.basename(versionPath))?.[1]);
    await this.writeSidecarAndChat(versionPath, folderPath, result, brief);
    await this.pinKitIfUsed(projectId, result.text);

    // The gate guarantees this parses; the snapshot feeds clip defaults.
    const config = parseCompositionConfig(result.text);
    return {
      ...provisional,
      activeVersion: version,
      status: 'ready',
      ...(config
        ? {
            config: {
              durationInFrames: config.durationInFrames,
              fps: config.fps,
              width: config.width,
              height: config.height,
            },
          }
        : {}),
    };
  }

  /** Q4 export pinning: the first accepted kit-importing version snapshots the
   *  installed kit into <project>/kit/<version>/ (write-once inside). Never
   *  fails the save — the export path has its own fallback. */
  private async pinKitIfUsed(projectId: string, source: string): Promise<void> {
    if (!shotUsesKit(source)) return;
    await ensureProjectKitSnapshot(projectId).catch(() => {});
  }

  private async writeSidecarAndChat(
    versionPath: string,
    folderPath: string,
    result: TsxPipelineResult,
    userText: string,
  ): Promise<void> {
    await writeDebugSidecar(versionPath, {
      model: result.model,
      durationMs: result.durationMs,
      timestamp: new Date().toISOString(),
      prompt: userText,
      ...describeSystemPrompt(result.systemPrompt),
      turns: result.debugLog,
      steps: result.steps,
      plan: result.plan,
      mode: result.mode,
      verified: result.verified,
      transpileValid: result.transpileValid,
      fixAttempts: result.fixAttempts,
      usage: result.usage,
    }).catch((err) => log.warn('Failed to write shot debug sidecar', { error: String(err) }));
    await appendChatTurns(folderPath, [
      { role: 'user', content: userText },
      { role: 'assistant', content: `Saved ${path.basename(versionPath)}.` },
    ]).catch(() => {});
  }
}

export const shotGenerator = new ShotGeneratorService();
