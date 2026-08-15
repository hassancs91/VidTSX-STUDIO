// Import a TSX as a shot (TSX_SHOTS_DESIGN.md §D14) — ONE source-agnostic
// accept path.
//
// The whole slice is this function: take a SOURCE FILE + a DISPLAY NAME, copy
// it into shots/<id>/v1.tsx, run the existing acceptance gate (transpile +
// react/remotion import lint + compositionConfig parse), and hand back a ready
// registry entry. Callers are thin and interchangeable: the Creator picker
// (creator-projects.ts finds the file), the OS file picker (the user finds
// it), and later a purchasable tsx-template pack (the pack folder holds it,
// PACKS_DESIGN.md). Nothing below knows which one called — that is the point.
//
// An imported shot carries `origin: { by: 'user' }` and NO stored brief, so
// Regenerate is correctly disabled (there is nothing to regenerate from) while
// Edit works exactly as it does for generated shots.
//
// The allowlist gap is handled as conform-on-import: a file whose only problem
// is chroma-js / @remotion/shapes|paths|transitions / @remotion/google-fonts /
// tone gets a pointed error plus "Convert for Studio" — ONE editTsxPipeline
// pass re-validated by the SAME gate, with the untouched original kept beside
// it as original.tsx.
//
// Main writes ONLY shots/<id>/ files; the registry entry travels to the
// renderer on the shared shot job-event stream and is adopted via shots-adopt.

import fs from 'fs/promises';
import path from 'path';
import { editTsxPipeline } from '../../../shared/tsx-engine';
import type { StudioShot } from '../../../shared/types/studio';
import {
  buildConformInstruction,
  classifyShotImport,
  deriveImportName,
  describeImportFailure,
} from '../../../shared/studio/shot-import';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';
import { reserveProjectFolder, writeNextVersion } from '../tsx-jobs/project-store';
import { buildShotEngineDeps, validateShotCode } from './shot-generator';
import { shotJobEvents } from './shot-job-events';
import { getProjectDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ShotImport');

/** The pre-conform source, kept for reference (D14). Never a version file, so
 *  the version scan, the preview and the export copy all ignore it. */
export const ORIGINAL_FILE_NAME = 'original.tsx';

export interface ImportShotRequest {
  projectId: string;
  /** Absolute path of the .tsx to import — a Creator version file, a picked
   *  file, or (later) a pack item. The ONLY thing the accept path needs. */
  sourcePath: string;
  /** Display name; derived from the path when absent. */
  name?: string;
  /** Second pass: rewrite out-of-allowlist imports with one LLM run. */
  conform?: boolean;
  providerId?: string;
  /** Fires once the shot folder exists — the IPC handshake returns then and a
   *  conform run continues detached (the generator's handshake pattern). */
  onReserved?: (shotId: string) => void;
}

export interface ImportShotOutcome {
  shotId?: string;
  error?: string;
  /** The failure is only the allowlist gap — offer "Convert for Studio". */
  conformable?: boolean;
}

/**
 * Write an accepted source into a fresh shot folder. Split out from the flow
 * above it because it is the part with no electron in it: give it a shots
 * directory and it reserves `<name>`, `<name>-2`, … exactly like generation
 * does, so importing the same source twice yields two distinct shots.
 */
export async function writeImportedShot(
  shotsDir: string,
  name: string,
  code: string,
  originalCode?: string,
): Promise<{ shotId: string; folderPath: string; versionPath: string }> {
  const reserved = await reserveProjectFolder(name, shotsDir);
  if (originalCode !== undefined) {
    await fs.writeFile(path.join(reserved.folderPath, ORIGINAL_FILE_NAME), originalCode, 'utf-8');
  }
  const versionPath = await writeNextVersion(reserved.folderPath, code);
  return { shotId: reserved.name, folderPath: reserved.folderPath, versionPath };
}

/**
 * Registry entry for an imported shot. The ABSENT `prompt` is load-bearing:
 * there is no brief behind an import, so the inspector's Regenerate is
 * correctly disabled while Edit works exactly as it does for generated shots.
 */
export function buildImportedShot(
  shotId: string,
  name: string,
  code: string,
  version = 1,
): StudioShot {
  const config = parseCompositionConfig(code);
  return {
    id: shotId,
    name,
    // Imported compositions are standalone, full-frame pieces: they cover the
    // footage. An overlay is a deliberate transparent thing, not a default.
    kind: 'cutaway',
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
    origin: { by: 'user' },
  };
}

async function readSource(sourcePath: string): Promise<string> {
  if (!/\.[jt]sx$/i.test(sourcePath)) {
    throw new Error(`Only .tsx compositions can be imported (got ${path.basename(sourcePath)}).`);
  }
  try {
    return await fs.readFile(sourcePath, 'utf-8');
  } catch {
    throw new Error(`Could not read ${sourcePath}`);
  }
}

/**
 * The accept path. Clean sources land instantly; a source that only trips the
 * allowlist gap comes back with `conformable: true` and no files written, so
 * the caller can offer Convert — which re-enters here with `conform: true`.
 */
export async function importShot(req: ImportShotRequest): Promise<ImportShotOutcome> {
  const projectDir = await getProjectDir(req.projectId);
  const shotsDir = path.join(projectDir, 'shots');
  const name = req.name?.trim() || deriveImportName(req.sourcePath);

  let source: string;
  try {
    source = await readSource(req.sourcePath);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read the source file' };
  }

  // A source that already passes needs no conversion, even if one was asked
  // for — never burn an LLM run on a file the gate accepts.
  const gate = await validateShotCode(source);
  if (gate.success) {
    const { shotId } = await writeImportedShot(shotsDir, name, source);
    req.onReserved?.(shotId);
    const shot = buildImportedShot(shotId, name, source);
    shotJobEvents.emit({ projectId: req.projectId, shotId, op: 'import', status: 'ready', shot });
    log.info('Imported shot', { projectId: req.projectId, shotId, source: req.sourcePath });
    return { shotId };
  }

  const classification = classifyShotImport(source);
  if (!req.conform) {
    // A syntax error is not an import problem — never offer a conform run for it.
    const transpile = await validateTsxCode(source);
    if (!transpile.success) {
      return { error: transpile.error ?? 'The file could not be compiled.' };
    }
    return {
      error: describeImportFailure(classification, gate.error ?? 'Import failed the shot gate'),
      ...(classification.canConform ? { conformable: true } : {}),
    };
  }

  return conformImport(req, shotsDir, name, source, classification.conformable);
}

/**
 * "Convert for Studio": one editTsxPipeline pass whose validate dep IS the
 * acceptance gate, so a conversion that doesn't conform never reaches disk as
 * a version. The folder is reserved first (progress needs an id) and the
 * untouched original is written immediately — a failed conversion leaves an
 * error shot the user can delete, with the original still there to look at.
 */
async function conformImport(
  req: ImportShotRequest,
  shotsDir: string,
  name: string,
  source: string,
  modules: string[],
): Promise<ImportShotOutcome> {
  const reserved = await reserveProjectFolder(name, shotsDir);
  const shotId = reserved.name;
  await fs.writeFile(path.join(reserved.folderPath, ORIGINAL_FILE_NAME), source, 'utf-8');
  req.onReserved?.(shotId);

  const provisional: StudioShot = {
    id: shotId,
    name,
    kind: 'cutaway',
    createdAt: new Date().toISOString(),
    activeVersion: 1,
    status: 'generating',
    origin: { by: 'user' },
  };
  // The edit pipeline's step labels say "Editing" — prefixed here so the pool
  // card reads as what the user actually asked for.
  const progress = (percent: number, message: string): void =>
    shotJobEvents.emit({
      projectId: req.projectId,
      shotId,
      op: 'import',
      status: 'generating',
      percent,
      message: `Converting — ${message}`,
      shot: provisional,
    });

  progress(0, 'starting');

  try {
    const result = await editTsxPipeline(
      {
        currentCode: source,
        editInstruction: buildConformInstruction(modules),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        onProgress: (p) => progress(p.percent, p.stepLabel),
      },
      buildShotEngineDeps(req.providerId),
    );
    if (!result.transpileValid) {
      throw new Error(
        'The converted composition still fails the shot gate (react + remotion only, default export, compositionConfig) — the original is kept as original.tsx.',
      );
    }

    const versionPath = await writeNextVersion(reserved.folderPath, result.text);
    const version = Number(/v(\d+)\.tsx$/.exec(path.basename(versionPath))?.[1]);
    const shot = buildImportedShot(shotId, name, result.text, version);
    shotJobEvents.emit({ projectId: req.projectId, shotId, op: 'import', status: 'ready', shot });
    log.info('Converted and imported shot', { projectId: req.projectId, shotId, modules });
    return { shotId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversion failed';
    shotJobEvents.emit({
      projectId: req.projectId,
      shotId,
      op: 'import',
      status: 'error',
      error: message,
      shot: { ...provisional, status: 'error', error: message },
    });
    log.error('Shot conversion failed', err, { projectId: req.projectId, shotId });
    return { shotId, error: message };
  }
}
