/**
 * manifest.json written by scripts/ai-runtime/build-stack.ps1 at the root of every
 * runtime zip. Read after extraction to prove the folder is the runtime the
 * catalogue promised, and at status time to know what is installed.
 */
import fs from 'fs/promises';
import path from 'path';
import type { AiRuntimeVariant } from '@shared/ipc/types/ai-runtime';

export interface AiRuntimeManifest {
  schema: number;
  name: string;
  version: string;
  variant: AiRuntimeVariant;
  python: string;
  pythonBuild?: string;
  torch: string;
  cuda: string | null;
  minDriver: string | null;
  lockFile?: string;
  lockSha256?: string;
  maxRelativePathLength: number;
  deepestPath?: string;
  bytesOnDisk: number;
  files: number;
  /** Folder holding python.exe, relative to the runtime root. */
  pythonDir: string;
  pipelines?: string[];
  builtAt?: string;
}

export const AI_RUNTIME_MANIFEST_NAME = 'manifest.json';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`manifest.json: "${field}" must be a non-empty string`);
  return v;
}

function num(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`manifest.json: "${field}" must be a non-negative number`);
  return v;
}

function nullableStr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Validate a parsed manifest object; throws a readable error on any missing field. */
export function parseAiRuntimeManifest(raw: unknown): AiRuntimeManifest {
  if (!isRecord(raw)) throw new Error('manifest.json: not a JSON object');
  const variant = str(raw.variant, 'variant');
  if (variant !== 'cu126' && variant !== 'cpu') throw new Error(`manifest.json: unknown variant "${variant}"`);
  return {
    schema: typeof raw.schema === 'number' ? raw.schema : 1,
    name: str(raw.name, 'name'),
    version: str(raw.version, 'version'),
    variant,
    python: str(raw.python, 'python'),
    pythonBuild: typeof raw.pythonBuild === 'string' ? raw.pythonBuild : undefined,
    torch: str(raw.torch, 'torch'),
    cuda: nullableStr(raw.cuda),
    minDriver: nullableStr(raw.minDriver),
    lockFile: typeof raw.lockFile === 'string' ? raw.lockFile : undefined,
    lockSha256: typeof raw.lockSha256 === 'string' ? raw.lockSha256 : undefined,
    maxRelativePathLength: num(raw.maxRelativePathLength, 'maxRelativePathLength'),
    deepestPath: typeof raw.deepestPath === 'string' ? raw.deepestPath : undefined,
    bytesOnDisk: num(raw.bytesOnDisk, 'bytesOnDisk'),
    files: num(raw.files, 'files'),
    pythonDir: typeof raw.pythonDir === 'string' && raw.pythonDir ? raw.pythonDir : 'python',
    pipelines: Array.isArray(raw.pipelines) ? raw.pipelines.filter((p): p is string => typeof p === 'string') : undefined,
    builtAt: typeof raw.builtAt === 'string' ? raw.builtAt : undefined,
  };
}

/** Read + validate `<dir>/manifest.json`. */
export async function readAiRuntimeManifest(dir: string): Promise<AiRuntimeManifest> {
  const text = await fs.readFile(path.join(dir, AI_RUNTIME_MANIFEST_NAME), 'utf8');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`manifest.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseAiRuntimeManifest(raw);
}

/** python.exe of a runtime folder, from its manifest. */
export function aiRuntimePythonPath(dir: string, manifest: Pick<AiRuntimeManifest, 'pythonDir'>): string {
  return path.join(dir, manifest.pythonDir, 'python.exe');
}
