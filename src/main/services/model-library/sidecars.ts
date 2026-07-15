/**
 * Sidecar file IO — `<modelfile>.vidtsx.json`.
 *
 * A sidecar stores custom-model configuration (family, name, default
 * overrides) next to the model file. Reads never throw: a missing file yields
 * `{ sidecar: null }`, and corrupt/wrong-version content yields
 * `{ sidecar: null, issue: 'unreadable-sidecar' }`. No `electron` import.
 */
import { promises as fs } from 'fs';
import type { ModelIssue, SidecarFileV1 } from '@shared/model-library/types';

const SIDECAR_SUFFIX = '.vidtsx.json';

/** `/models/foo.safetensors` → `/models/foo.safetensors.vidtsx.json`. */
export function sidecarPathFor(modelFilePath: string): string {
  return `${modelFilePath}${SIDECAR_SUFFIX}`;
}

export interface ReadSidecarResult {
  sidecar: SidecarFileV1 | null;
  issue?: Extract<ModelIssue, { code: 'unreadable-sidecar' }>;
}

/**
 * Read and validate a sidecar. Missing file → `{ sidecar: null }` (not an
 * issue). Invalid JSON or `version !== 1` → `{ sidecar: null, issue }`.
 */
export async function readSidecar(modelFilePath: string): Promise<ReadSidecarResult> {
  const sidecarPath = sidecarPathFor(modelFilePath);

  let raw: string;
  try {
    raw = await fs.readFile(sidecarPath, 'utf-8');
  } catch {
    // Missing (or unreadable) sidecar — normal for profile-matched files.
    return { sidecar: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      sidecar: null,
      issue: { code: 'unreadable-sidecar', filePath: sidecarPath, reason: 'invalid-json' },
    };
  }

  if (!isValidSidecar(parsed)) {
    return {
      sidecar: null,
      issue: { code: 'unreadable-sidecar', filePath: sidecarPath, reason: 'unsupported-version' },
    };
  }

  return { sidecar: parsed };
}

export async function writeSidecar(
  modelFilePath: string,
  sidecar: SidecarFileV1,
): Promise<void> {
  const sidecarPath = sidecarPathFor(modelFilePath);
  await fs.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf-8');
}

/** Remove a sidecar; tolerates a missing file. */
export async function deleteSidecar(modelFilePath: string): Promise<void> {
  const sidecarPath = sidecarPathFor(modelFilePath);
  try {
    await fs.unlink(sidecarPath);
  } catch {
    // Already gone — nothing to do.
  }
}

function isValidSidecar(value: unknown): value is SidecarFileV1 {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.category === 'string';
}
