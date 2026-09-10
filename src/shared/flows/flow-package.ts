// `flow.json` — the `.vidtsxflow` package manifest (flows plan §1.7, §0.1
// item 4, W8 Stage 6). It IS a `FlowDoc` plus the package fields an agent
// manifest carries: `author`, `version`, `minAppVersion`, `requires`,
// `files[]`, an optional `icon` and `license`.
//
// PURE: zod, the shared id grammar, the structural flow validator. What the
// running app knows — its version, its registered tool ids, its capability
// gates — arrives through `FlowManifestContext`, so one function serves the
// install validator, `scripts/flow-pack.mjs --check`, and the unit tests.
//
// The container rules (entry-path safety, reserved side files, size caps) are
// the agents' Stage 2 rules verbatim: the reader is the same `zip-reader.ts`
// and the signature the same `signature.json` over the canonical JSON.

import { z } from 'zod';
import { isSafeEntryPath } from '../packages/entry-path';
import { parseAgentId } from '../agents/ids';
import { compareAgentVersions } from '../agents/manifest';
import type { AgentAuthor, AgentFileEntry } from '../types/agents';
import { FLOW_DOC_FORMAT_VERSION, type FlowDoc } from '../types/flows';
import { validateFlowDoc } from './validate';

export const FLOW_MANIFEST_NAME = 'flow.json';
export const FLOW_PACKAGE_EXT = '.vidtsxflow';

/** Container caps — a flow is a document plus a few reference assets. */
export const FLOW_LIMITS = {
  maxEntries: 200,
  maxTotalBytes: 32 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024,
  maxManifestBytes: 512 * 1024,
} as const;

/** Written by the store or the signer, never listed (agents plan §1.6). */
export const FLOW_RESERVED_ENTRIES: readonly string[] = ['signature.json', 'licensee.json'];

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?$/;

export interface FlowRequires {
  /** Every tool id the graph uses — checked against the registry at install. */
  tools: string[];
  /** Capability gates (`needs`) the flow's nodes carry, for the website and the card. */
  capabilities: string[];
}

/** The package manifest: the document with the package fields on top. */
export interface FlowPackageManifest extends FlowDoc {
  version: string;
  author: AgentAuthor;
  minAppVersion: string;
  license?: string;
  icon?: string;
  updateUrl?: string;
  requires: FlowRequires;
  files: AgentFileEntry[];
}

export class FlowManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'FlowManifestError';
  }
}

export interface FlowManifestContext {
  /** When given, `minAppVersion` must not exceed it. */
  appVersion?: string;
  /** When given, every tool the graph uses (and `requires.tools` names) must be one of these. */
  toolIds?: readonly string[];
}

const fileEntry = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex characters'),
});

/** Only the package fields are typed strictly here; the document half is
 *  checked by `validateFlowDoc`, whose messages name nodes and params. */
const packageFields = z.object({
  formatVersion: z.number().int().positive(),
  id: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  version: z.string().regex(SEMVER_RE, 'version must be semver (e.g. 1.0.0)'),
  author: z.object({ name: z.string().min(1), url: z.string().optional() }),
  minAppVersion: z.string().regex(SEMVER_RE, 'minAppVersion must be semver'),
  license: z.string().optional(),
  icon: z.string().optional(),
  updateUrl: z.string().optional(),
  requires: z.object({
    tools: z.array(z.string()).default([]),
    capabilities: z.array(z.string()).default([]),
  }),
  files: z.array(fileEntry).default([]),
  params: z.array(z.unknown()).default([]),
  graph: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  }),
  outputs: z.array(z.unknown()).default([]),
  origin: z.unknown().optional(),
});

/** The tool ids a graph uses, in node order, deduplicated. */
export function graphToolIds(doc: Pick<FlowDoc, 'graph'>): string[] {
  const seen = new Set<string>();
  for (const node of doc.graph.nodes) if (node.toolId) seen.add(node.toolId);
  return [...seen];
}

/** The document half of a manifest — what the store row and the runner hold. */
export function flowDocOf(manifest: FlowPackageManifest): FlowDoc {
  return {
    formatVersion: FLOW_DOC_FORMAT_VERSION,
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    params: manifest.params,
    graph: manifest.graph,
    outputs: manifest.outputs,
    origin: manifest.origin ?? null,
  };
}

/**
 * Parse and validate a package manifest. Throws `FlowManifestError` carrying
 * every problem, so an author sees the whole list at once.
 */
export function parseFlowPackageManifest(raw: unknown, ctx: FlowManifestContext = {}): FlowPackageManifest {
  const parsed = packageFields.safeParse(raw);
  if (!parsed.success) {
    throw new FlowManifestError(parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`));
  }
  const m = parsed.data;
  const problems: string[] = [];

  if (m.formatVersion !== FLOW_DOC_FORMAT_VERSION) {
    problems.push(`formatVersion ${m.formatVersion} is not supported (this app reads ${FLOW_DOC_FORMAT_VERSION})`);
  }
  // A packaged flow is namespaced — its id is its install folder, and a ulid
  // would collide with the user's own rows. Export rewrites a ulid before packing.
  if (!parseAgentId(m.id)) {
    problems.push(`id "${m.id}" must be "<namespace>/<name>", each [a-z0-9-]`);
  }
  if (ctx.appVersion && compareAgentVersions(m.minAppVersion, ctx.appVersion) > 0) {
    problems.push(`needs VidTSX ${m.minAppVersion} (this app is ${ctx.appVersion})`);
  }

  const paths = new Set<string>();
  let totalBytes = 0;
  for (const file of m.files) {
    if (!isSafeEntryPath(file.path)) {
      problems.push(`files: unsafe entry path "${file.path}"`);
      continue;
    }
    if (FLOW_RESERVED_ENTRIES.includes(file.path) || file.path === FLOW_MANIFEST_NAME) {
      problems.push(`files: "${file.path}" is written by the store and must not be listed`);
      continue;
    }
    if (paths.has(file.path)) {
      problems.push(`files: duplicate entry "${file.path}"`);
      continue;
    }
    if (file.size > FLOW_LIMITS.maxEntryBytes) {
      problems.push(`files: "${file.path}" is ${file.size} bytes (max ${FLOW_LIMITS.maxEntryBytes})`);
    }
    totalBytes += file.size;
    paths.add(file.path);
  }
  if (totalBytes > FLOW_LIMITS.maxTotalBytes) {
    problems.push(`files: ${totalBytes} bytes total (max ${FLOW_LIMITS.maxTotalBytes})`);
  }
  if (m.files.length > FLOW_LIMITS.maxEntries) {
    problems.push(`files[] has ${m.files.length} entries (max ${FLOW_LIMITS.maxEntries})`);
  }
  if (m.icon && !paths.has(m.icon)) {
    problems.push(`icon "${m.icon}" is not listed in files[]`);
  }
  if (m.updateUrl && !m.updateUrl.startsWith('https://')) {
    problems.push('updateUrl must be an https URL');
  }

  // The document half: the same structural gate the canvas and the runner use.
  const doc = flowDocOf(m as unknown as FlowPackageManifest);
  const structural = validateFlowDoc(doc, { requireNodes: true });
  if (!structural.ok) {
    for (const err of structural.errors) problems.push(`graph: ${err.message}`);
  }

  // `requires.tools` must name every tool the graph uses (the packer's --hash
  // writes it), and every one of them must exist in THIS build.
  const used = graphToolIds(doc);
  for (const tool of used) {
    if (!m.requires.tools.includes(tool)) problems.push(`requires.tools does not list "${tool}", which the graph uses`);
  }
  if (ctx.toolIds) {
    for (const tool of new Set([...m.requires.tools, ...used])) {
      if (!ctx.toolIds.includes(tool)) problems.push(`requires.tools "${tool}" is not a registered tool`);
    }
  }

  if (problems.length > 0) throw new FlowManifestError(problems);
  return m as unknown as FlowPackageManifest;
}

/** Whether a bare JSON file is a package manifest (has the package fields)
 *  rather than a plain `FlowDoc` — the import path routes on this. */
export function looksLikeFlowManifest(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.version === 'string' && typeof obj.requires === 'object' && obj.requires !== null;
}
