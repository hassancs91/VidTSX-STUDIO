// What the builder's two tool files share (TSX_BUILDER_DESIGN.md T2):
// builder-tools.ts holds the registry, `check` and `finish`;
// builder-look-tools.ts the four that render. The run state, the result
// helpers, the event log and the check every tool starts with live here.
//
// Stopping (cancel or a cap) aborts `state.signal`: a render in flight is
// cancelled, a call that arrives after it is refused, and nothing is
// committed after it — a `finish` racing a cancel does not count.

import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { checkBuild, type BuildCheckResult } from './build-check';
import { isPhysicsEngine, isWebGlLibrary } from '../../../shared/tsx-engine/builder-libraries';
import type { CompositionConfig } from '../composition-config-parser';
import type { BuildStillShown, RunDirs } from './build-store';
import type { BuildAssetSource } from './build-stills';
import { ASSETS_DIR, assetKeyMap, formatBytes, listAssetFiles } from './build-assets';
import { shotAssetKey } from '../studio/shot-bundle-finish';
import { BACKDROP_ENTRY, backdropLookSource } from './look-backdrop';
import type { BuildFormat, BuildPhase, BuildProgressDetail, StudioShotBuild } from './types';

export interface BuilderState {
  dirs: RunDirs;
  /** The requested frame; `check` fails a config that departs from it. */
  expect: BuildFormat;
  /** A Studio shot (P3 part 5): what a transparent shot's looks draw behind it. */
  studioShot?: StudioShotBuild;
  roundsMax: number;
  /** finish is refused before this many rounds (unless the budget is spent). */
  roundsMin: number;
  /** Look rounds: render_stills and contact_sheet calls. */
  roundsUsed: number;
  /** The build the last render_stills / contact_sheet showed. `finish` holds the final build to it (P3 D1). */
  lastLook: { code: string } | null;
  /** Looks taken after the budget was spent, each on a build changed since the last look (VERIFY_LOOK_ALLOWANCE). */
  verifyLooks: number;
  checks: number;
  /** phone_view calls (free, capped per run). */
  phoneViews: number;
  /** loop_seam calls (free). */
  seamChecks: number;
  /** The last loop_seam measurement: the build it measured and its verdict. `finish` compares it with its own final check. */
  lastSeam: { code: string; jump: boolean } | null;
  /** Builds (by buildHash) that loop_seam called a JUMP: the same build measured twice counts once. */
  seamJumps: Set<string>;
  /** purity_check calls (free). */
  purityChecks: number;
  /** The last purity_check: the build it measured and its verdict. `finish` compares it with its own final check on a physics piece. */
  lastPurity: { code: string; pure: boolean } | null;
  /** Builds (by buildHash) that purity_check called IMPURE: the same build measured twice counts once. */
  impureBuilds: Set<string>;
  /** The last artifact that passed every gate — what a capped run returns. `physics`: it inlines a physics engine. */
  lastGood: { code: string; config: CompositionConfig; check: number; physics: boolean } | null;
  finished: { summary: string; code: string; config: CompositionConfig; physics: boolean } | null;
  /** Every image shown to the builder, in order — saved with the version. */
  stills: BuildStillShown[];
  /** generate_image: allowed this run, made so far, and their estimated cost. */
  imagesMax: number;
  imagesGenerated: number;
  imageCostUsd: number;
  /** Aborted when the run stops (cancel or a cap). */
  signal?: AbortSignal;
  /** Tool calls in flight: the run awaits them before it saves. */
  inFlight: Set<Promise<unknown>>;
  /** Progress out (tsx-builder.ts wires these to BuildProgress). */
  onEvent?: (detail: BuildProgressDetail) => void;
  onPhase?: (phase: BuildPhase) => void;
}

export type ToolContent = Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
export type ToolResult = { content: ToolContent; isError?: boolean };

export const text = (t: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(isError ? { isError: true } : {}),
});

export const STOPPING = 'The run is stopping. Reply with one short line and stop.';

/**
 * Looks allowed after the budget is spent, each on a build changed since the
 * last look (P3 D1): B6 rewrote its physics after its last round and finished
 * unseen in motion. Two = a look at the fix, and one more if that look shows
 * something to fix. After them `finish` lets an unseen build through, logged.
 */
export const VERIFY_LOOK_ALLOWANCE = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/** A short id for one checked build, for the event log and the seam record. */
export function buildHash(code: string): string {
  return createHash('sha256').update(code).digest('hex').slice(0, 8);
}

/** A build that inlines a physics engine (not just the @vidtsx/sim helper): `finish` holds it to purity_check. */
export function isPhysicsBuild(packages: string[]): boolean {
  return packages.some(isPhysicsEngine);
}

/** A build that inlines a 3D library draws on WebGL: its contact sheet renders tile by tile. */
export function isWebGlBuild(packages: string[]): boolean {
  return packages.some(isWebGlLibrary);
}

/** True when the last render_stills / contact_sheet showed exactly `code`. */
export function lookedAt(state: BuilderState, code: string): boolean {
  return state.lastLook !== null && state.lastLook.code === code;
}

/** Where a look sits in the budget: a round, or (P3 D1) a look at a build changed after the budget was spent. */
export type LookSlot = { verify: boolean; label: string };

export function takeLook(state: BuilderState, code: string): LookSlot | ToolResult {
  if (state.roundsUsed < state.roundsMax) {
    state.roundsUsed += 1;
    return { verify: false, label: `r${pad(state.roundsUsed)}` };
  }
  if (!lookedAt(state, code) && state.verifyLooks < VERIFY_LOOK_ALLOWANCE) {
    state.verifyLooks += 1;
    // Its own label: the last round's stills on disk are not overwritten.
    return { verify: true, label: `r${pad(state.roundsUsed)}v${state.verifyLooks}` };
  }
  const why = lookedAt(state, code)
    ? 'you have looked at this exact build: call finish'
    : `the ${VERIFY_LOOK_ALLOWANCE} extra looks at a changed build are used too: call finish`;
  return text(`The look budget is spent (${state.roundsMax}/${state.roundsMax}) and ${why}.`, true);
}

/** A render failure is the build's fault (a runtime error), not the budget's. */
export function giveBack(state: BuilderState, slot: LookSlot): void {
  if (slot.verify) state.verifyLooks -= 1;
  else state.roundsUsed -= 1;
}

/** True when the last purity_check measured exactly `code` and said PURE. */
export function pureOkFor(state: BuilderState, code: string): boolean {
  return state.lastPurity !== null && state.lastPurity.code === code && state.lastPurity.pure;
}

/** True when the last loop_seam measured exactly `code` and said OK. */
export function seamOkFor(state: BuilderState, code: string): boolean {
  return state.lastSeam !== null && state.lastSeam.code === code && !state.lastSeam.jump;
}

export async function logEvent(state: BuilderState, event: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  await fs.appendFile(path.join(state.dirs.runDir, 'events.jsonl'), `${line}\n`, 'utf-8').catch(() => {});
}

/** One tool call: refused once stopped, tracked while in flight, its phase shown while it runs. */
export function tracked<A>(state: BuilderState, phase: BuildPhase, handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    if (state.signal?.aborted) return text(STOPPING, true);
    state.onPhase?.(phase);
    const run = handler(args);
    state.inFlight.add(run);
    try {
      return await run;
    } finally {
      state.inFlight.delete(run);
      if (state.inFlight.size === 0 && !state.signal?.aborted) state.onPhase?.('working');
    }
  };
}

export async function runCheck(state: BuilderState): Promise<BuildCheckResult> {
  state.checks += 1;
  const result = await checkBuild(state.dirs.workDir, state.expect);
  if (result.ok && result.code && result.config) {
    state.lastGood = { code: result.code, config: result.config, check: state.checks, physics: isPhysicsBuild(result.inlinedPackages) };
    const dir = path.join(state.dirs.runDir, 'checkpoints');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `c${String(state.checks).padStart(2, '0')}.tsx`), result.code, 'utf-8');
  }
  await logEvent(state, {
    tool: 'check',
    n: state.checks,
    ok: result.ok,
    ms: result.ms,
    errors: result.errors,
    files: result.inlinedFiles,
    packages: result.inlinedPackages,
    ...(result.assets.length > 0 ? { assets: result.assets.map((a) => a.relPath) } : {}),
  });
  state.onEvent?.({ type: 'check', n: state.checks, ok: result.ok, errors: result.errors });
  return result;
}

export function describeCheck(result: BuildCheckResult): string {
  if (!result.ok) return `check FAILED:\n- ${result.errors.join('\n- ')}`;
  const c = result.config!;
  const files = result.assets.length
    ? `; assets: ${result.assets.map((a) => `${a.relPath} (${formatBytes(a.bytes)})`).join(', ')}`
    : '';
  return `check passed: ${result.inlinedFiles.length + 1} file(s) bundled (${result.code!.length} bytes), packages: ${result.inlinedPackages.join(', ') || 'none'}${files}; ${c.width}x${c.height}, ${c.fps} fps, ${c.durationInFrames} frames (${(c.durationInFrames / c.fps).toFixed(2)} s).`;
}

/**
 * The build's assets folder and the keys a look hands it: every file there by
 * its key, so a shot made before the builder that reads `props.assets.logo`
 * shows its media in the stills too (P3 part 5), and the keys its staticFile()
 * calls look up over them. Undefined when there is nothing to hand.
 */
export async function assetSourceFor(state: BuilderState, result: BuildCheckResult): Promise<BuildAssetSource | undefined> {
  const dir = path.join(state.dirs.workDir, ASSETS_DIR);
  const files = (await listAssetFiles(dir)).filter((f) => f.kind !== null);
  const keys = { ...Object.fromEntries(files.map((f) => [shotAssetKey(f.relPath), f.relPath])), ...assetKeyMap(result.assets) };
  return Object.keys(keys).length > 0 ? { dir, keys } : undefined;
}

/** What render_stills, contact_sheet and phone_view render instead of the piece itself. */
export interface LookWrapper {
  code: string;
  entryName: string;
  /** The footage under the piece; absent = a checkerboard. */
  backdropFile?: string;
}

/**
 * A transparent Studio shot is looked at over its footage, or a checkerboard
 * (look-backdrop.ts). A build the wrapper cannot rename (check passed it, so
 * this should not happen) is looked at alone rather than failing the look.
 */
export function lookWrapperFor(state: BuilderState, code: string, config: CompositionConfig): LookWrapper | undefined {
  const shot = state.studioShot;
  if (!shot?.transparent) return undefined;
  const startFrame = shot.backdrop ? shot.backdrop.startSeconds * config.fps : null;
  try {
    return {
      code: backdropLookSource(code, config, startFrame),
      entryName: BACKDROP_ENTRY,
      ...(shot.backdrop ? { backdropFile: shot.backdrop.file } : {}),
    };
  } catch {
    return undefined;
  }
}

export type CheckedBuild = {
  code: string;
  config: CompositionConfig;
  summary: string;
  assets?: BuildAssetSource;
  /** It inlines a 3D library (isWebGlBuild). */
  webgl: boolean;
  /** Set for a transparent Studio shot: what the picture looks render. */
  look?: LookWrapper;
};

/** The check every look starts with: the build to render, or the reply that ends the call. */
export async function checkForLook(state: BuilderState): Promise<{ build: CheckedBuild } | { reply: ToolResult }> {
  const result = await runCheck(state);
  if (!result.ok || !result.code || !result.config) return { reply: text(describeCheck(result), true) };
  if (state.signal?.aborted) return { reply: text(STOPPING, true) };
  const assets = await assetSourceFor(state, result);
  const look = lookWrapperFor(state, result.code, result.config);
  return {
    build: {
      code: result.code,
      config: result.config,
      summary: describeCheck(result),
      webgl: isWebGlBuild(result.inlinedPackages),
      ...(assets ? { assets } : {}),
      ...(look ? { look } : {}),
    },
  };
}
