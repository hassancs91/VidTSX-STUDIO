// Flows — the flow document, ports, node specs and run contracts shared by
// main, preload and the renderer (docs/flows-plan.md §1.1–§1.3, Stage 0).
// Pure types plus two tiny helpers; nothing here touches Node or Electron.

import type { ArtifactKind, InteractionRequest } from './agents';

/** The current `FlowDoc.formatVersion`. v1 was the bare `GraphJson`. */
export const FLOW_DOC_FORMAT_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// Ports (§1.2)
// ---------------------------------------------------------------------------

/** What travels on a port: an artifact of the matching kind, or a primitive. */
export type DataType =
  | 'text'
  | 'image'
  | 'images'
  | 'video'
  | 'audio'
  | 'composition'
  | 'transcript'
  | 'number';

export interface PortDef {
  id: string;
  label: string;
  dataType: DataType;
  required?: boolean;
  /** Inputs: the handler argument this port fills (defaults to the port id). */
  argKey?: string;
  /** Outputs: the returned artifact, or a named field of the tool result. */
  from?: 'artifact' | `field:${string}`;
}

/** Inspector field kinds — the existing canvas set, unchanged. */
export type ConfigField =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'prompt'; key: string; label: string; placeholder?: string; rows?: number }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'model-picker'; key: string; label: string; providerKeyKey?: string }
  | { kind: 'llm-model-picker'; key: string; label: string; providerKeyKey?: string }
  | { kind: 'video-model-picker'; key: string; label: string; providerKeyKey?: string }
  // Duration / aspect / resolution / audio / seed read from the selected
  // model's capabilities. Owns those config keys itself, the way
  // 'image-upload' owns fileName/width/height — so it needs no `label`.
  | { kind: 'video-model-options'; key: string; providerKeyKey?: string; modelKey?: string }
  | { kind: 'gallery-image-picker'; key: string; label: string }
  | { kind: 'image-upload'; key: string; label: string };

export type ConfigFieldKind = ConfigField['kind'];

/** `image` → `images` is the one widening the canvas allows. */
export function isPortCompatible(source: DataType, target: DataType): boolean {
  if (source === target) return true;
  if (source === 'image' && target === 'images') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Node specs (§1.2) — what the renderer fetches over FLOWS_NODES_LIST
// ---------------------------------------------------------------------------

export type NodeCategory =
  | 'input'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'composition'
  | 'library'
  | 'agent';

export interface ToolPorts {
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: ConfigField[];
  defaultConfig: Record<string, unknown>;
  category: NodeCategory;
}

/** Serialisable description of one node; no handler travels with it. */
export interface NodeSpec {
  /** The tool id (append-only in the registry). */
  id: string;
  label: string;
  description: string;
  category: NodeCategory;
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: ConfigField[];
  defaultConfig: Record<string, unknown>;
  /** Capability gate (provider ids, binaries); unmet = a warning chip. */
  needs?: string[];
  /** §0.1 item 6: the run form lists priced steps; the price hint is free text. */
  priced?: boolean;
  priceHint?: string;
  /** Only `run_agent` — the canvas marks the non-deterministic step. */
  nondeterministic?: boolean;
}

// ---------------------------------------------------------------------------
// The flow document (§1.1)
// ---------------------------------------------------------------------------

/** The run-form field kinds: the inspector set plus the two media picks. */
export type FlowParamKind = ConfigFieldKind | 'image' | 'video';

export type FlowParamOption = string | { value: string; label: string };

export interface FlowParamBind {
  nodeId: string;
  /** A config key of that node — locked in the inspector once bound. */
  key: string;
}

export interface FlowParam {
  id: string;
  label: string;
  kind: FlowParamKind;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: FlowParamOption[];
  default?: unknown;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  bind: FlowParamBind[];
}

export type FlowModelMode = 'required' | 'preferred' | 'default';

/** Node config is the tool's own bag of keys (the inspector fields). Two keys
 *  have fixed meaning where present: `brandId` (per-node brand, only on nodes
 *  whose service takes one — absent = run-level, `null` = none, §0.1 item 9)
 *  and `modelMode` (`FlowModelMode`, decision 12, on model-bound nodes). */
export type FlowNodeConfig = Record<string, unknown>;

export interface FlowPosition {
  x: number;
  y: number;
}

export interface FlowNode {
  /** A ulid or `n-[a-z0-9-]+` (matched case-insensitively — the canvas mints
   *  `n-<ULID>` in upper case). */
  id: string;
  toolId: string;
  position: FlowPosition;
  config: FlowNodeConfig;
  /** Decision 4: pause after this node in attended runs. */
  pause: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
}

export interface FlowOutput {
  nodeId: string;
  handle: string;
  label: string;
}

/** Set when a flow was frozen from an agent session (§1.5). */
export interface FlowOrigin {
  agentId: string;
  sessionId: string;
  artifactId: string;
}

/** Where a SQLite row came from (the `source` column, §2). Built-in and
 *  installed flows live on disk, not in SQLite. */
export type FlowSource = 'user' | 'template' | 'frozen' | 'imported';

export interface FlowDoc {
  formatVersion: typeof FLOW_DOC_FORMAT_VERSION;
  /** ulid, or `<ns>/<name>` for packaged flows. */
  id: string;
  name: string;
  description: string;
  /** The run form, in order. */
  params: FlowParam[];
  graph: FlowGraph;
  /** What the run form shows large. */
  outputs: FlowOutput[];
  origin: FlowOrigin | null;
}

// ---------------------------------------------------------------------------
// Runs (§1.3) — run.json and the events on FLOWS_RUN_EVENT
// ---------------------------------------------------------------------------

export type FlowRunMode = 'attended' | 'unattended';

export type FlowRunDocStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'success'
  | 'error'
  | 'cancelled';

export type FlowNodeRunStatus = 'idle' | 'running' | 'paused' | 'done' | 'error' | 'skipped';

/** A port value: an artifact reference (files stay in the run folder) or a
 *  primitive. Base64 never travels on a port (§11). */
export type FlowPortValue =
  | { kind: 'artifact'; artifactId: string; artifactKind: ArtifactKind }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number };

export interface FlowNodeRunState {
  status: FlowNodeRunStatus;
  outputs?: Record<string, FlowPortValue>;
  error?: string;
  durationMs?: number;
  attempts: number;
}

/** `run.json` — the run folder's record; the SQLite summary row is
 *  `FlowRunRecord` in the IPC types. */
export interface FlowRunDoc {
  id: string;
  flowId: string;
  /** The flow's `updatedAt` (SQLite) or package version at start. */
  flowVersion: string;
  mode: FlowRunMode;
  params: Record<string, unknown>;
  /** Run-level brand: absent = library default, `null` = none (§0.1 item 9). */
  brandId?: string | null;
  status: FlowRunDocStatus;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  nodes: Record<string, FlowNodeRunState>;
  /** The checkpoint awaiting a reply, if any. */
  pending?: { nodeId: string; requestId: string } | null;
}

export type FlowRunEvent =
  | { runId: string; kind: 'node-status'; nodeId: string; state: FlowNodeRunState }
  | { runId: string; kind: 'run-status'; status: FlowRunDocStatus; error?: string }
  | { runId: string; kind: 'pause-request'; nodeId: string; request: InteractionRequest };
