// Shot-kit prompt info (SHOT_QUALITY_DESIGN.md Q4): the pack's MANIFEST.md is
// cited VERBATIM in the shot prompt as the kit's complete API, alongside the
// kitVersion. Degrade rule: missing/corrupt pack yields null and the prompt
// simply has no KIT section — generation must not fail because a bundled
// resource is bad (exemplars precedent).
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getShotKitDir } from '../../utils/paths';
import { readKitPackVersion } from '../kit-bundler';

const log = logEngine.createLogger('ShotKit');

export interface ShotKitPromptInfo {
  version: string;
  /** MANIFEST.md verbatim. */
  manifest: string;
}

/** Root as a parameter so this half is testable without electron. */
export async function loadKitPromptInfoFromDir(kitDir: string): Promise<ShotKitPromptInfo | null> {
  try {
    const manifest = await fs.readFile(path.join(kitDir, 'MANIFEST.md'), 'utf-8');
    if (manifest.trim().length === 0) return null;
    return { version: await readKitPackVersion(kitDir), manifest };
  } catch {
    return null;
  }
}

/** The built-in kit's prompt info — what the generator injects (Q4). */
export async function getShotKitPromptInfo(): Promise<ShotKitPromptInfo | null> {
  try {
    return await loadKitPromptInfoFromDir(path.join(getShotKitDir(), 'core'));
  } catch (err) {
    log.warn('Shot kit manifest unavailable — generating without a KIT section', {
      error: String(err),
    });
    return null;
  }
}
