// What a Studio transcription is primed with (V1 completion plan §2.4):
// the project's brand vocabulary, its script's proper nouns and the active
// vocabulary memories, composed into the provider keyterm list and the
// alias rules the post-pass applies. Never throws — a brand or memory
// problem must not block a transcription; each source degrades to empty.

import { logEngine } from '../../../logging/log-engine';
import type { StudioBrand } from '../../../shared/types/asset-library';
import type { StudioMemory } from '../../../shared/types/studio-memory';
import { listMemories } from './agent-memory';
import { buildAliasRules, type AliasRule } from '../stt/alias-postpass';
import { composeKeyterms } from '../stt/keyterms';
import { resolveProjectBrand } from './project-brand';
import { loadProject } from './project-store';

const log = logEngine.createLogger('TranscriptionContext');

export interface TranscriptionContext {
  keyterms: string[];
  aliasRules: AliasRule[];
  counts: { brand: number; memory: number; script: number };
  brandId?: string;
}

export const EMPTY_TRANSCRIPTION_CONTEXT: TranscriptionContext = {
  keyterms: [],
  aliasRules: [],
  counts: { brand: 0, memory: 0, script: 0 },
};

export async function loadTranscriptionContext(projectId: string): Promise<TranscriptionContext> {
  let brandId: string | undefined;
  let script: string | undefined;
  try {
    const project = await loadProject(projectId);
    brandId = project.settings.brandId;
    script = project.script;
  } catch (err) {
    log.warn('Project unreadable — transcribing without vocabulary', { projectId, error: String(err) });
    return EMPTY_TRANSCRIPTION_CONTEXT;
  }
  let brand: StudioBrand | null = null;
  try {
    brand = await resolveProjectBrand(projectId, brandId);
  } catch (err) {
    log.warn('Brand unreadable — no brand vocabulary this run', { projectId, error: String(err) });
  }
  let memories: StudioMemory[] = [];
  try {
    memories = await listMemories();
  } catch (err) {
    log.warn('Memory unreadable — no vocabulary memories this run', { error: String(err) });
  }
  const scope = {
    ...(brand?.vocabulary ? { brandVocabulary: brand.vocabulary } : {}),
    memories,
    // Memories are scoped to the LIBRARY brand id; a project-local snapshot
    // has none, so only app-wide entries apply there.
    ...(brand && brand.id !== 'project' ? { brandId: brand.id } : {}),
  };
  const composed = composeKeyterms({ ...scope, ...(script ? { script } : {}) });
  return {
    keyterms: composed.keyterms,
    aliasRules: buildAliasRules(scope),
    counts: composed.counts,
    ...(scope.brandId ? { brandId: scope.brandId } : {}),
  };
}
