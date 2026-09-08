// View types for the Agents feature. Anything main also needs lives in
// `src/shared/types/agents.ts`; these exist only inside the renderer.

import type { ChatRowMessage } from '@renderer/components/agent-chat/AgentMessageRow';

/** A chat row plus the live-stream flag; the persisted shape has neither. */
export type AgentChatRow = ChatRowMessage;

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
