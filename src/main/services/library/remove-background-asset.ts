// remove_background behind the Studio agent tool (plan §7b wave-1): takes a library
// image (a "library:<path>" ref from generate_image / capture_webpage, or a plain
// library-relative path), runs the shared `runPythonModel('rembg-u2net')` service, and
// files the cut-out next to the source as born-managed content (origin 'generated',
// description "<source> — background removed"). The same path an agent or a flow
// node takes: nothing here knows about Python.

import path from 'path';
import { ensureLibraryRoot, resolveLibraryPath, toLibraryRelPath } from './library-paths';
import { upsertEntry } from './library-store';
import { runPythonModel, preflightPythonModel, preferredRembgModelId, REMBG_DEFAULT_MODEL_ID, type RunPythonModelResult } from '../python-models';
import type { PythonModelPreflightIpc } from '@shared/ipc/types/python-models';

/** The model the install dialog offers; the run itself upgrades to ISNet when it is downloaded. */
export const REMBG_MODEL_ID = REMBG_DEFAULT_MODEL_ID;

export interface RemoveBackgroundAssetRequest {
  /** Library-relative path of the source image (a "library:" prefix is accepted). */
  relPath: string;
  options?: { alphaMatting?: boolean; postProcessMask?: boolean };
  signal?: AbortSignal;
  onProgress?: (stage: string, pct?: number) => void;
}

export interface RemovedBackgroundAsset {
  relPath: string;
  absPath: string;
  width: number | null;
  height: number | null;
  seconds: number;
  description: string;
}

export function stripLibraryPrefix(ref: string): string {
  return ref.startsWith('library:') ? ref.slice('library:'.length).trim() : ref.trim();
}

/** The structured not-ready result, for callers that want to ask before installing. */
export function preflightRemoveBackground(): Promise<PythonModelPreflightIpc> {
  return preflightPythonModel(REMBG_MODEL_ID);
}

export async function removeBackgroundAsset(req: RemoveBackgroundAssetRequest): Promise<RemovedBackgroundAsset> {
  const root = await ensureLibraryRoot();
  const relPath = stripLibraryPrefix(req.relPath).replace(/\\/g, '/');
  const absSource = resolveLibraryPath(root, relPath); // traversal guard
  const result: RunPythonModelResult = await runPythonModel({
    modelId: await preferredRembgModelId(),
    input: { imagePath: absSource },
    options: {
      alphaMatting: req.options?.alphaMatting === true,
      postProcessMask: req.options?.postProcessMask === true,
    },
    outputDir: path.dirname(absSource),
    source: { libraryRelPath: relPath },
    signal: req.signal,
    onProgress: req.onProgress ? (e) => req.onProgress?.(e.stage, e.pct) : undefined,
  });
  const outRel = toLibraryRelPath(root, result.outputPath);
  const description = `${path.basename(relPath)} — background removed`;
  await upsertEntry(root, outRel, { origin: 'generated', description });
  return {
    relPath: outRel,
    absPath: result.outputPath,
    width: typeof result.stats.width === 'number' ? result.stats.width : null,
    height: typeof result.stats.height === 'number' ? result.stats.height : null,
    seconds: result.seconds,
    description,
  };
}
