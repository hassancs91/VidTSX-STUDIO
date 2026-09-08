// Agents IPC contracts (agents plan §3). The renderer never sees a filesystem
// path it could act on: it sends ids and receives records, and every path in a
// payload is relative to a root main owns.

import type {
  AgentArtifact,
  AgentChatMessage,
  AgentJobStatus,
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
  /**
   * An installed agent id, or a package file to read without installing.
   * NEITHER means "let the user find one": main opens the OS picker, so the
   * renderer never handles a path it did not already have.
   */
  agentId?: string;
  filePath?: string;
}

export interface AgentsInspectResponse {
  success: boolean;
  agent?: InstalledAgent;
  /** The package that was read, when main picked it. */
  filePath?: string;
  /** The picker was dismissed — not an error. */
  canceled?: boolean;
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

export interface AgentSessionRenameRequest {
  agentId: string;
  sessionId: string;
  title: string;
}

export interface AgentSessionRenameResponse {
  success: boolean;
  session?: AgentSession;
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
  agentId: string;
  sessionId: string;
}

export interface AgentRunCancelResponse {
  success: boolean;
}

export interface AgentInteractionReplyRequest {
  agentId: string;
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
  /** `open-in-studio` only: the Studio project the shot is imported into. The
   *  renderer knows it from `useOpenProject`; main will not guess one. */
  projectId?: string;
}

export interface AgentArtifactActionResponse {
  success: boolean;
  /** Where the action put the thing, when it produced one (library-relative). */
  relPath?: string;
  /** Screen the renderer should navigate to, when the action asks for one. */
  navigateTo?: 'creator' | 'studio' | 'render' | 'assets';
  /** `open-in-creator`: the project written for the target screen to open. */
  open?: { folderPath: string; versionPath: string };
  error?: string;
}

// ─── Viewer data (§1.5 "the viewer asks main to re-transpile and serve") ───

export interface AgentArtifactResolveRequest {
  agentId: string;
  sessionId: string;
  artifactId: string;
}

export interface AgentArtifactResolveResponse {
  success: boolean;
  /** `document`: the markdown body, read from the session workspace. */
  text?: string;
  /** `composition`: a live module url, re-transpiled when the store is cold. */
  moduleUrl?: string;
  /** `video` / `image-set`: one servable url per file, in payload order. */
  assetUrls?: string[];
  error?: string;
}

// ─── Render jobs the renderer's queue owns (§1.5) ───

export interface AgentJobUpdateRequest {
  agentId: string;
  sessionId: string;
  /** The `job` artifact minted at submit time. */
  artifactId: string;
  status: AgentJobStatus;
  progress?: number;
  /** Where the queue wrote the file, on a completed render. */
  outputPath?: string;
  error?: string;
}

export interface AgentJobUpdateResponse {
  success: boolean;
  error?: string;
}
