import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import {
  buildMovePlan,
  type InUseSet,
  type OrganizePlan,
  EMPTY_IN_USE,
} from './organize-plan';
import {
  ORGANIZE_SYSTEM_PROMPT,
  buildOrganizeDigest,
  parseOrganizeSuggestions,
} from './organize-suggest';

const log = logEngine.createLogger('LibraryOrganize');

/**
 * The organize SUGGEST pass (ASSET_LIBRARY_DESIGN.md L7): index → LLM →
 * reviewable plan. Applying the accepted half lives in `organize-apply.ts`
 * — deliberately a separate module, so the disk moves carry none of the
 * provider import chain.
 *
 * The plan itself is built in `organize-plan.ts` (pure), which is where
 * the in-use exclusion rule lives and is tested.
 */

/** Suggest a plan. The provider is the app default — curation has no project. */
export async function suggestOrganize(
  entries: ReadonlyArray<LibraryIndexEntry>,
  inUse: InUseSet = EMPTY_IN_USE,
  signal?: AbortSignal,
): Promise<OrganizePlan> {
  if (entries.length === 0) return { moves: [], skipped: [], discarded: 0 };

  const res = await runLlmGenerate(
    {
      prompt: buildOrganizeDigest(entries),
      systemPrompt: ORGANIZE_SYSTEM_PROMPT,
      maxTokens: 4000,
      featureSource: 'library-organize',
    },
    signal,
  );
  if (!res.success || !res.text) {
    throw new Error(res.error ?? 'The organize pass returned nothing');
  }
  const suggestions = parseOrganizeSuggestions(res.text);
  const plan = buildMovePlan(entries, suggestions, inUse);
  log.info('Organize plan built', {
    suggested: suggestions.length,
    moves: plan.moves.length,
    skipped: plan.skipped.length,
    discarded: plan.discarded,
  });
  return plan;
}
