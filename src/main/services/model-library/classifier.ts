/**
 * Category-agnostic file classifier.
 *
 * Pure logic (design §4): decides what a scanned file is, in strict order —
 *   1. profile filename match (case-insensitive, exact)
 *   2. sidecar `<file>.vidtsx.json` present → custom model
 *   3. filename is a known companion → companion inventory (not a model)
 *   4. otherwise → unrecognized
 *
 * No fs access except the injected `readSidecar`, which keeps this testable
 * with plain stubs.
 */
import type { ScannedFile, SidecarFileV1 } from '@shared/model-library/types';

/** Minimal profile shape the classifier needs (full envelopes are assignable). */
export interface ClassifierProfile {
  id: string;
  matchFileNames?: string[];
}

export interface ClassifyContext {
  profiles: ClassifierProfile[];
  /** Lower-cased companion filename → companion kind (e.g. 'ae.safetensors' → 'vae'). */
  companionFileNames: Record<string, string>;
  /** Injected sidecar reader; may be sync or async. */
  readSidecar: (
    modelFilePath: string,
  ) => SidecarFileV1 | null | Promise<SidecarFileV1 | null>;
}

export type Classification =
  | { kind: 'profile'; profileId: string }
  | { kind: 'custom'; sidecar: SidecarFileV1 }
  | { kind: 'companion'; companionKind: string }
  | { kind: 'unrecognized' };

export async function classifyFile(
  file: ScannedFile,
  ctx: ClassifyContext,
): Promise<Classification> {
  const lowerName = file.fileName.toLowerCase();

  // 1. Exact (case-insensitive) filename match against any profile.
  for (const profile of ctx.profiles) {
    if (!profile.matchFileNames) continue;
    for (const candidate of profile.matchFileNames) {
      if (candidate.toLowerCase() === lowerName) {
        return { kind: 'profile', profileId: profile.id };
      }
    }
  }

  // 2. Sidecar → custom model (profile match above always wins over a sidecar).
  const sidecar = await ctx.readSidecar(file.absolutePath);
  if (sidecar) {
    return { kind: 'custom', sidecar };
  }

  // 3. Known companion filename → companion inventory, not a listed model.
  const companionKind = ctx.companionFileNames[lowerName];
  if (companionKind) {
    return { kind: 'companion', companionKind };
  }

  // 4. Unknown file — surfaced in the UI with a "Set up" action.
  return { kind: 'unrecognized' };
}
