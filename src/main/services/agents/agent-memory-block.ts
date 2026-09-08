// The memory block an agent session runs with (agents plan §1.10).
//
// The MECHANISM IS REUSED, NOT REBUILT: one store file, one composer, one
// budget. This module is only the scope — app-wide entries plus the ones the
// user scoped to THIS agent — and the logging of what the budget dropped, which
// is the same reporting the Studio agent does with the same numbers.
//
// It stays the TRAILING block for cache reasons (§1.2 step 3): editing memory
// must not rewrite the skill text out of the cached prefix.

import { composeMemoryBlock } from '../studio/agent-memory-prompt';
import { listMemories } from '../studio/agent-memory';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentMemory');

export interface AgentMemoryScopeInput {
  agentId: string;
  /** The session's brand, so brand-scoped entries apply the same way. */
  brandId?: string;
}

/**
 * `undefined` when there is nothing active in scope — the composer returns ''
 * and the prompt must not carry an empty section.
 *
 * A failure here is logged and swallowed: a session that cannot read memory
 * should still run, exactly as the Studio agent's does.
 */
export async function buildAgentMemoryBlock(
  scope: AgentMemoryScopeInput,
): Promise<string | undefined> {
  try {
    const memories = await listMemories();
    const composed = composeMemoryBlock(memories, {
      agentId: scope.agentId,
      ...(scope.brandId ? { brandId: scope.brandId } : {}),
    });
    if (composed.droppedProfile || composed.droppedVocabulary > 0 || composed.rulesOverflowBy > 0) {
      log.warn('Memory block trimmed to fit the budget', {
        agentId: scope.agentId,
        droppedProfile: composed.droppedProfile,
        droppedVocabulary: composed.droppedVocabulary,
        rulesOverflowBy: composed.rulesOverflowBy,
      });
    }
    return composed.block || undefined;
  } catch (err) {
    log.warn('Could not read agent memory — running without the block', {
      agentId: scope.agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
