/**
 * Installed / missing-files / runtime state for every catalogue model (plan §4 step 2).
 * A model is "installed" when every file it needs — its own and its companions' — is on
 * disk at the catalogue size; "ready" when the pinned runtime is installed too.
 */
import fs from 'fs/promises';
import path from 'path';
import type { PythonModelStatusIpc, PythonModelFileStatusIpc } from '@shared/ipc/types/python-models';
import type { AiRuntimeState } from '@shared/ipc/types/ai-runtime';
import { evaluateFit } from '@shared/model-library/fit';
import { getPythonModelsRoot } from '../../utils/paths';
import { getAllDownloads } from '../download-manager';
import { AI_RUNTIME_VERSION, computeAiRuntimeState, isAiRuntimeInstalling, scanInstalledRuntime } from '../ai-runtime';
import { getPreflightHardware } from '../system-info';
import {
  PYTHON_MODEL_CATALOG,
  PYTHON_MODEL_DOWNLOAD_TYPE,
  formatModelBytes,
  pythonModelAllFiles,
  pythonModelById,
  pythonModelOwnBytes,
  type PythonModelFile,
  type PythonModelProfile,
} from './registry';

export function pythonModelFilePath(file: PythonModelFile, root = getPythonModelsRoot()): string {
  return path.join(root, ...file.dest.split('/'));
}

export interface PythonModelFileState extends PythonModelFileStatusIpc {
  file: PythonModelFile;
  absPath: string;
}

/** Present = exists with exactly the catalogue byte count (a `.part` never counts). */
export async function checkPythonModelFiles(profile: PythonModelProfile, root = getPythonModelsRoot()): Promise<PythonModelFileState[]> {
  const out: PythonModelFileState[] = [];
  for (const file of pythonModelAllFiles(profile)) {
    const absPath = pythonModelFilePath(file, root);
    let present = false;
    try {
      const st = await fs.stat(absPath);
      present = st.isFile() && st.size === file.bytes;
    } catch {
      present = false;
    }
    out.push({ file, absPath, label: file.label, dest: file.dest, bytes: file.bytes, present });
  }
  return out;
}

export function isPythonModelDownloading(modelId: string): boolean {
  return getAllDownloads().some(
    (d) => d.metadata?.type === PYTHON_MODEL_DOWNLOAD_TYPE && d.metadata.modelId === modelId && !['completed', 'failed', 'cancelled'].includes(d.status),
  );
}

export interface RuntimeSnapshot {
  state: AiRuntimeState;
  variant: 'cu126' | 'cpu' | null;
  version: string | null;
  python: string | null;
  cuda: boolean;
}

/** One scan of the runtime folder, shared by every status row of a request. */
export async function runtimeSnapshot(): Promise<RuntimeSnapshot> {
  const scan = await scanInstalledRuntime();
  const state = computeAiRuntimeState(scan, AI_RUNTIME_VERSION, isAiRuntimeInstalling());
  if (scan.kind !== 'installed') return { state, variant: null, version: null, python: null, cuda: false };
  return { state, variant: scan.info.variant, version: scan.info.version, python: scan.info.python, cuda: scan.info.variant === 'cu126' };
}

export async function getPythonModelStatus(modelId: string, runtime?: RuntimeSnapshot): Promise<PythonModelStatusIpc> {
  const profile = pythonModelById(modelId);
  if (!profile) throw new Error(`Unknown model: ${modelId}`);
  const rt = runtime ?? (await runtimeSnapshot());
  const files = await checkPythonModelFiles(profile);
  const installed = files.every((f) => f.present);
  const bytesMissing = files.filter((f) => !f.present).reduce((n, f) => n + f.bytes, 0);
  let fit: PythonModelStatusIpc['fit'];
  if (profile.vramMb !== null) {
    const hw = await getPreflightHardware();
    // The runtime, not the file size, decides VRAM use: judge the declared floor alone.
    fit = evaluateFit({ minVramGB: profile.vramMb / 1024, sizeBytes: 0 }, hw);
  }
  return {
    id: profile.id,
    category: profile.category,
    section: profile.section,
    name: profile.name,
    summary: profile.summary,
    sizeBytes: pythonModelOwnBytes(profile),
    sizeLabel: formatModelBytes(pythonModelOwnBytes(profile)),
    bytesMissing,
    licence: profile.licence,
    sourceUrl: profile.sourceUrl,
    installed,
    files: files.map(({ label, dest, bytes, present }) => ({ label, dest, bytes, present })),
    downloading: isPythonModelDownloading(profile.id),
    runtime: { state: rt.state, variant: rt.variant, version: rt.version },
    ready: installed && rt.state === 'installed',
    vramMb: profile.vramMb,
    cpuOk: profile.cpuOk,
    estimatedSeconds: profile.capability.estimatedSeconds,
    ...(fit ? { fit } : {}),
  };
}

export async function listPythonModelStatuses(category?: 'image' | '3d'): Promise<PythonModelStatusIpc[]> {
  const rt = await runtimeSnapshot();
  const profiles = PYTHON_MODEL_CATALOG.filter((p) => !category || p.category === category);
  return Promise.all(profiles.map((p) => getPythonModelStatus(p.id, rt)));
}
