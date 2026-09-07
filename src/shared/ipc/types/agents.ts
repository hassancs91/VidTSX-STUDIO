// Agents IPC contracts (agents plan §3). The renderer never sees a filesystem
// path it could act on: it sends ids and receives records, and every path in a
// payload is relative to a root main owns.

import type {
  AgentArtifact,
  AgentChatMessage,
  AgentSession,
  AgentSessionSummary,
  InstalledAgent,
  InteractionReply,
  StarterAnswers,
} from '../../types/agents';

// ─── Installed agents ───

export interface AgentsListResponse {
  success: boolean;
  agents?: InstalledAgent[];
  error?: string;
}

export interface AgentsInspectRequest {
  /** An installed agent id, or a package file to read without installing. */
  agentId?: string;
  filePath?: string;
}

export interface AgentsInspectResponse {
  success: boolean;
  agent?: InstalledAgent;
  /** Per-buyer stamp the store added; never signed, shown for information. */
  licensee?: { name: string; orderId?: string; issuedAt?: string };
  error?: string;
}

export interface AgentsInstallRequest {
  filePath: string;
  /** Set after the user confirmed a downgrade. */
  confirmDowngrade?: boolean;
}

export interface AgentsInstallResponse {
  success: boolean;
  agent?: InstalledAgent;
  /** The install stopped and wants an explicit yes first. */
  needsConfirm?: 'downgrade';
  /** Version already installed, when `needsConfirm` is set. */
  installedVersion?: string;
  error?: string;
}

export interface AgentsRemoveRequest {
  agentId: string;
}

export interface AgentsRemoveResponse {
  success: boolean;
  /** A built-in that reappeared once the user copy was removed. */
  restoredBuiltin?: InstalledAgent;
  error?: string;
}

export interface AgentsCheckUpdateRequest {
  agentId: string;
}

export interface AgentsCheckUpdateResponse {
  success: boolean;
  agent?: InstalledAgent;
  error?: string;
}

// ─── Sessions ───

export interface AgentSessionsListRequest {
  agentId: string;
}

export interface AgentSessionsListResponse {
  success: boolean;
  sessions?: AgentSessionSummary[];
  error?: string;
}

export interface AgentSessionCreateRequest {
  agentId: string;
  title?: string;
  providerId?: string;
  starter?: StarterAnswers;
}

export interface AgentSessionCreateResponse {
  success: boolean;
  session?: AgentSession;
  error?: string;
}

export interface AgentSessionLoadRequest {
  agentId: string;
  sessionId: string;
}

export interface AgentSessionLoadResponse {
  success: boolean;
  session?: AgentSession;
  messages?: AgentChatMessage[];
  artifacts?: AgentArtifact[];
  error?: string;
}

export interface AgentSessionDeleteRequest {
  agentId: string;
  sessionId: string;
}

export interface AgentSessionDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Runs ───

export interface AgentRunSendRequest {
  agentId: string;
  sessionId: string;
  prompt: string;
  providerId?: string;
  model?: string;
}

export interface AgentRunSendResponse {
  success: boolean;
  text?: string;
  /** False on a provider that cannot run tools — the degraded mode (§1.8). */
  toolsAvailable?: boolean;
  error?: string;
}

export interface AgentRunCancelRequest {
  sessionId: string;
}

export interface AgentRunCancelResponse {
  success: boolean;
}

export interface AgentInteractionReplyRequest {
  sessionId: string;
  reply: InteractionReply;
}

export interface AgentInteractionReplyResponse {
  success: boolean;
  error?: string;
}

// ─── Artifact handoffs (§1.4 action bar) ───

export type AgentArtifactActionKind =
  | 'save-to-library'
  | 'open-in-creator'
  | 'open-in-studio'
  | 'send-to-queue'
  | 'open-folder'
  | 'copy-path';

export interface AgentArtifactActionRequest {
  agentId: string;
  sessionId: string;
  artifactId: string;
  action: AgentArtifactActionKind;
}

export interface AgentArtifactActionResponse {
  success: boolean;
  /** Where the action put the thing, when it produced one (library-relative). */
  relPath?: string;
  /** Screen the renderer should navigate to, when the action asks for one. */
  navigateTo?: 'creator' | 'studio' | 'render' | 'assets';
  error?: string;
}
