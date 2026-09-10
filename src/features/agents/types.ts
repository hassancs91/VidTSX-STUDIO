// View types for the Agents feature. Anything main also needs lives in
// `src/shared/types/agents.ts`; these exist only inside the renderer.

import type { AgentChatRow } from '@renderer/hooks/agents/event-folding';

/** The chat row the shared run hook folds events into (W7: lives with the hook). */
export type { AgentChatRow };

/** Which half of the Agents screen is on: the grid, or one agent's workspace. */
export type AgentsView =
  | { screen: 'gallery' }
  | { screen: 'workspace'; agentId: string; sessionId: string | null };

export interface AgentCapability {
  id: string;
  label: string;
}

/** Trust as the card shows it — one tag, never two (§1.7). */
export interface TrustTag {
  label: string;
  tone: 'accent' | 'warning' | 'neutral';
  /** The one-line notice the import dialog adds for anything unverified. */
  notice?: string;
}
