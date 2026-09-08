// Agents — the shared contracts every later stage codes against
// (docs/agents-plan.md §1.1, §1.3, §1.4, §1.5). Types only: no zod, no I/O,
// no process-specific imports, so main and the renderer share one definition.

import type { StarterTree } from '../agents/starter';

// ---------------------------------------------------------------------------
// Package manifest (§1.1)
// ---------------------------------------------------------------------------

/** The only SDK built-ins a package may ask for. `Bash` is never allowed. */
export const AGENT_SDK_TOOLS_ALWAYS = ['WebSearch', 'WebFetch'] as const;
/** Additionally allowed when `workspace.sdkFileTools` is true (path-guarded). */
export const AGENT_SDK_TOOLS_FILES = ['Read', 'Write', 'Edit', 'Glob', 'Grep'] as const;

export type AgentSdkTool =
  | (typeof AGENT_SDK_TOOLS_ALWAYS)[number]
  | (typeof AGENT_SDK_TOOLS_FILES)[number];

export interface AgentAuthor {
  name: string;
  url?: string;
}

/** One packaged file, hashed in the manifest so extraction can verify it. */
export interface AgentFileEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface AgentSubagent {
  description: string;
  prompt: string;
  tools?: string[];
}

export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AgentManifest {
  formatVersion: number;
  /** `<namespace>/<name>`, both `[a-z0-9-]+` (see shared/agents/ids.ts). */
  id: string;
  name: string;
  /** semver. */
  version: string;
  description: string;
  author: AgentAuthor;
  license?: string;
  /** App version this package needs; install refuses below it. */
  minAppVersion: string;
  icon?: string;
  /** Package entry holding the system prompt body (usually `AGENT.md`). */
  prompt: string;
  /** Registry tool ids the agent may call — the MCP allowlist. */
  tools: string[];
  /** SDK built-ins, never `Bash`. */
  sdkTools?: AgentSdkTool[];
  artifacts?: ArtifactKind[];
  interactions?: InteractionKind[];
  starter?: StarterTree;
  defaults?: { maxTurns?: number; effort?: AgentEffort };
  subagents?: Record<string, AgentSubagent>;
  /** SDK file tools run behind the path guard, inside the session workspace. */
  workspace?: { sdkFileTools?: boolean };
  /** Opt in to `propose_memory` (§1.10). */
  memory?: { propose?: boolean };
  /** https URL serving the update JSON; fetched only on user click. */
  updateUrl?: string;
  files: AgentFileEntry[];
}

export type AgentSignatureStatus = 'verified' | 'signed-unknown' | 'unsigned';

export interface AgentUpdateInfo {
  version: string;
  url: string;
  minAppVersion: string;
  notes?: string;
  /** False when the update needs a newer app than this one. */
  compatible: boolean;
}

/** An agent as the app found it on disk. */
export interface InstalledAgent {
  manifest: AgentManifest;
  origin: 'builtin' | 'user';
  /** Absolute folder — main owns it; the renderer treats it as opaque. */
  dir: string;
  signature: AgentSignatureStatus;
  /** Publisher key id, when the package carried a signature. */
  keyId?: string;
  /** Filled by "Check for update" only; the app never fetches on its own. */
  update?: AgentUpdateInfo;
}

// ---------------------------------------------------------------------------
// Artifacts (§1.4)
// ---------------------------------------------------------------------------

/** Every artifact kind, as a value: the manifest validator checks a package's
 *  declared kinds against this list at install time (plan §1.1). */
export const ARTIFACT_KINDS = ['document', 'composition', 'video', 'image-set', 'job'] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Markdown inside the session workspace. */
export interface DocumentPayload {
  relPath: string;
}

export interface AgentCompositionConfig {
  id: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export interface CompositionPayload {
  /** TSX file inside the session workspace — the durable half. */
  relPath: string;
  /** In-memory module URL; gone after a restart, re-served on demand. */
  moduleUrl?: string;
  config: AgentCompositionConfig;
}

export interface VideoPayload {
  /** Path inside the asset library, relative to its root. */
  relPath: string;
  width?: number;
  height?: number;
  durationSeconds: number;
  aspectRatio?: string;
  hasAudio?: boolean;
  /** Video Studio entry id, for clips the video engine also filed there. */
  entryId?: string;
}

export interface ImageSetPayload {
  items: Array<{ relPath: string; width: number; height: number }>;
}

export type AgentJobKind = 'render' | 'video';
export type AgentJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Minted at SUBMIT time, so it holds only what exists then. Everything the
 * output has — `relPath` above all — arrives when the job goes terminal, as a
 * SEPARATE artifact whose id lands in `resultArtifactId`. Never read an output
 * field off a job that is not terminal.
 */
export interface JobPayload {
  jobId: string;
  job: AgentJobKind;
  status: AgentJobStatus;
  progress?: number;
  error?: string;
  resultArtifactId?: string;
  /**
   * Renders only: where the output will be, RELATIVE to the library root.
   * Known at submit time (§1.11 builds the folder from the session), so a
   * session reopened after a restart can reconcile by asking whether that file
   * exists — the render queue lives in the renderer and main cannot ask it.
   */
  outputRelPath?: string;
}

export type ArtifactPayload =
  | ({ kind: 'document' } & DocumentPayload)
  | ({ kind: 'composition' } & CompositionPayload)
  | ({ kind: 'video' } & VideoPayload)
  | ({ kind: 'image-set' } & ImageSetPayload)
  | ({ kind: 'job' } & JobPayload);

type PayloadFor<K extends ArtifactKind> = Omit<Extract<ArtifactPayload, { kind: K }>, 'kind'>;

interface ArtifactBase<K extends ArtifactKind> {
  id: string;
  kind: K;
  title: string;
  createdAt: string;
  producer: { tool: string; callId: string };
  /** Compositions: `edit_composition` bumps it. */
  version?: number;
  payload: PayloadFor<K>;
}

export type AgentArtifact =
  | ArtifactBase<'document'>
  | ArtifactBase<'composition'>
  | ArtifactBase<'video'>
  | ArtifactBase<'image-set'>
  | ArtifactBase<'job'>;

export type ArtifactOfKind<K extends ArtifactKind> = Extract<AgentArtifact, { kind: K }>;

/**
 * What a TOOL returns. The runner assigns `id`, `createdAt`, `producer` and
 * `version` and performs the one write — tools never touch the store (§1.3).
 */
export type AgentArtifactDraft = {
  [K in ArtifactKind]: { kind: K; title: string; payload: PayloadFor<K> };
}[ArtifactKind];

// ---------------------------------------------------------------------------
// Interactions (§1.3, §1.5)
// ---------------------------------------------------------------------------

/** Wave-1 interaction kinds, as a value (see `ARTIFACT_KINDS`). */
export const INTERACTION_KINDS = ['form', 'pick', 'approve'] as const;

export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export interface InteractionFormField {
  id: string;
  label: string;
  kind: 'text' | 'multiline' | 'select';
  options?: Array<{ id: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export interface InteractionCandidate {
  id: string;
  label: string;
  detail?: string;
  /** Artifact this candidate stands for, so the stage can show it large. */
  artifactId?: string;
}

export type InteractionPayload =
  | { kind: 'form'; title: string; fields: InteractionFormField[] }
  | { kind: 'pick'; title: string; candidates: InteractionCandidate[]; select: 'one' | 'many' }
  | { kind: 'approve'; title: string; items: InteractionCandidate[] };

export interface InteractionRequest {
  id: string;
  sessionId: string;
  /** The tool call that asked, so a reply can be routed back to it. */
  callId: string;
  createdAt: string;
  payload: InteractionPayload;
}

export type InteractionReply =
  | { requestId: string; status: 'answered'; values: Record<string, string[]> }
  | { requestId: string; status: 'cancelled' }
  | { requestId: string; status: 'expired' };

// ---------------------------------------------------------------------------
// Run events (§1.2) and sessions (§1.5)
// ---------------------------------------------------------------------------

/** Handed to the renderer so it can enqueue through the ONE render queue. */
export interface AgentJobRequest {
  /** The `job` artifact minted at submit time. */
  artifactId: string;
  jobId: string;
  job: AgentJobKind;
  /** Composition artifact being rendered (render jobs only). */
  compositionArtifactId?: string;
  moduleUrl?: string;
  config?: AgentCompositionConfig;
  /** Library-relative folder the output is written into (§1.11). */
  outputFolder?: string;
  outputName?: string;
  /** Absolute TSX the render queue renders — it takes file paths, not urls. */
  tsxPath?: string;
  /** Absolute output path inside the library folder, so the queue writes the
   *  file where §1.11 wants it and filing is a library upsert, not a copy. */
  outputPath?: string;
}

export type AgentRunEvent =
  | { sessionId: string; kind: 'delta'; text: string }
  | { sessionId: string; kind: 'tool'; tool: string; callId: string; detail?: string }
  | { sessionId: string; kind: 'progress'; tool: string; callId: string; detail: string }
  | { sessionId: string; kind: 'artifact'; artifact: AgentArtifact }
  | { sessionId: string; kind: 'artifact-updated'; artifact: AgentArtifact }
  | { sessionId: string; kind: 'interaction'; request: InteractionRequest }
  | { sessionId: string; kind: 'interaction-cleared'; requestId: string }
  | { sessionId: string; kind: 'job-request'; request: AgentJobRequest }
  | { sessionId: string; kind: 'done'; text?: string; error?: string; cancelled?: boolean };

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/** Answers the starter tree collected, kept for the whole session. */
export type StarterAnswers = Record<string, { ids?: string[]; text?: string }>;

export interface AgentSession {
  id: string;
  agentId: string;
  agentVersion: string;
  title: string;
  createdAt: string;
  lastOpenedAt: string;
  providerId?: string;
  starter?: StarterAnswers;
  /**
   * Library-relative folder this session's media files into (§1.11), fixed at
   * creation. Stored rather than recomputed because renaming a session must
   * not move files that artifacts already point at.
   */
  libraryFolder?: string;
  /** Brand generated media is auto-tagged with; the library default at create. */
  brandId?: string;
  /** Library-relative image shown on the sessions list. */
  thumbnailRelPath?: string;
  /** Non-blocking `ask_user`: the question the user still owes an answer to. */
  pendingInteraction?: InteractionRequest;
}

/** Sessions list row — read without loading chat or artifacts. */
export interface AgentSessionSummary extends AgentSession {
  artifactCount: number;
}
