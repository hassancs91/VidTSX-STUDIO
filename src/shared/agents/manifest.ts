// `agent.json` — the package manifest parser (agents plan §1.1).
//
// PURE: zod plus the shared id/starter helpers, no filesystem and no registry
// imports. The checks that need the running app — which tool ids exist, which
// artifact and interaction kinds are registered, what version this build is —
// are supplied by the caller through `ManifestContext`, so the same function
// serves the install validator, `agent-pack.mjs --check`, and unit tests.

import { z } from 'zod';
import { isSafeEntryPath } from '../packages/entry-path';
import { parseAgentId } from './ids';
import { validateStarter, type StarterTree } from './starter';
import {
  AGENT_SDK_TOOLS_ALWAYS,
  AGENT_SDK_TOOLS_FILES,
  type AgentManifest,
} from '../types/agents';

export const AGENT_MANIFEST_NAME = 'agent.json';
export const AGENT_PACKAGE_EXT = '.vidtsxagent';
export const AGENT_FORMAT_VERSION = 1;

/** Container caps — the `.vidtsx` discipline, sized for a prompt-and-assets zip. */
export const AGENT_LIMITS = {
  maxEntries: 500,
  /** Uncompressed total across all entries. */
  maxTotalBytes: 64 * 1024 * 1024,
  maxEntryBytes: 32 * 1024 * 1024,
  maxManifestBytes: 256 * 1024,
  maxTools: 32,
  maxSubagents: 8,
} as const;

/**
 * Entries the manifest may never list. `signature.json` signs the manifest, so
 * the manifest cannot hash it; `licensee.json` is added by the store AFTER
 * signing (§1.6). Both are read through the zip reader's explicit unlisted door
 * instead, and a package listing either is malformed rather than merely odd.
 */
export const AGENT_RESERVED_ENTRIES: readonly string[] = ['signature.json', 'licensee.json'];

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?$/;

/** Numeric-triple compare, ignoring any prerelease suffix. -1 / 0 / 1. */
export function compareAgentVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((p) => (/^\d+$/.test(p) ? Number(p) : 0))
      .concat([0, 0])
      .slice(0, 3);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export class AgentManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'AgentManifestError';
  }
}

/** What the running app knows and the manifest is checked against. */
export interface ManifestContext {
  /** When given, `minAppVersion` must not exceed it. */
  appVersion?: string;
  /** When given, every `tools[]` entry must be one of these. */
  toolIds?: readonly string[];
  artifactKinds?: readonly string[];
  interactionKinds?: readonly string[];
}

const fileEntry = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex characters'),
});

const starterOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  next: z.string().min(1),
});

const starterNode = z.union([
  z.object({
    question: z.string().min(1),
    hint: z.string().optional(),
    text: z.literal(true),
    multiline: z.boolean().optional(),
    next: z.string().min(1),
  }),
  z.object({
    question: z.string().min(1),
    hint: z.string().optional(),
    select: z.enum(['one', 'many']),
    options: z.array(starterOption),
    allowOther: z.boolean().optional(),
    otherNext: z.string().optional(),
    next: z.string().optional(),
  }),
]);

const starterTree = z.object({
  entry: z.string().min(1),
  nodes: z.record(z.string(), starterNode),
  opening: z.string(),
  quickStarts: z.array(z.string()).optional(),
});

const subagent = z.object({
  description: z.string().min(1),
  prompt: z.string().min(1),
  tools: z.array(z.string()).optional(),
});

const manifestSchema = z.object({
  formatVersion: z.number().int().positive(),
  id: z.string(),
  name: z.string().min(1).max(80),
  version: z.string().regex(SEMVER_RE, 'version must be semver (e.g. 1.0.0)'),
  description: z.string().max(500).default(''),
  author: z.object({ name: z.string().min(1), url: z.string().optional() }),
  license: z.string().optional(),
  minAppVersion: z.string().regex(SEMVER_RE, 'minAppVersion must be semver'),
  icon: z.string().optional(),
  prompt: z.string().min(1),
  tools: z.array(z.string()).max(AGENT_LIMITS.maxTools),
  sdkTools: z.array(z.string()).optional(),
  artifacts: z.array(z.string()).optional(),
  interactions: z.array(z.string()).optional(),
  starter: starterTree.optional(),
  defaults: z
    .object({
      maxTurns: z.number().int().positive().max(200).optional(),
      effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
    })
    .optional(),
  subagents: z.record(z.string(), subagent).optional(),
  workspace: z.object({ sdkFileTools: z.boolean().optional() }).optional(),
  memory: z.object({ propose: z.boolean().optional() }).optional(),
  updateUrl: z.string().optional(),
  files: z.array(fileEntry),
});

/**
 * Parse and validate. Throws `AgentManifestError` carrying every problem, so
 * an author fixing a package sees the whole list rather than one at a time.
 */
export function parseAgentManifest(raw: unknown, ctx: ManifestContext = {}): AgentManifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AgentManifestError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`),
    );
  }
  const m = parsed.data;
  const problems: string[] = [];

  if (m.formatVersion !== AGENT_FORMAT_VERSION) {
    problems.push(
      `formatVersion ${m.formatVersion} is not supported (this app reads ${AGENT_FORMAT_VERSION})`,
    );
  }
  if (!parseAgentId(m.id)) {
    problems.push(`id "${m.id}" must be "<namespace>/<name>", each [a-z0-9-]`);
  }
  if (ctx.appVersion && compareAgentVersions(m.minAppVersion, ctx.appVersion) > 0) {
    problems.push(`needs VidTSX ${m.minAppVersion} (this app is ${ctx.appVersion})`);
  }

  // Entry names are the FIRST zip-slip gate (the reader resolves and re-checks
  // afterwards), and the caps here are what stop a small manifest fronting for
  // a large extraction. `--check` runs this same block, so an author sees the
  // problem before shipping rather than a buyer seeing it at install.
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const file of m.files) {
    if (!isSafeEntryPath(file.path)) {
      problems.push(`files: unsafe entry path "${file.path}"`);
      continue;
    }
    if (AGENT_RESERVED_ENTRIES.includes(file.path)) {
      problems.push(`files: "${file.path}" is written by the store and must not be listed`);
      continue;
    }
    if (paths.has(file.path)) {
      problems.push(`files: duplicate entry "${file.path}"`);
      continue;
    }
    if (file.size > AGENT_LIMITS.maxEntryBytes) {
      problems.push(`files: "${file.path}" is ${file.size} bytes (max ${AGENT_LIMITS.maxEntryBytes})`);
    }
    totalBytes += file.size;
    paths.add(file.path);
  }
  if (totalBytes > AGENT_LIMITS.maxTotalBytes) {
    problems.push(`files: ${totalBytes} bytes total (max ${AGENT_LIMITS.maxTotalBytes})`);
  }

  if (!paths.has(m.prompt)) {
    problems.push(`prompt "${m.prompt}" is not listed in files[]`);
  }
  if (m.icon && !paths.has(m.icon)) {
    problems.push(`icon "${m.icon}" is not listed in files[]`);
  }
  if (m.files.length > AGENT_LIMITS.maxEntries) {
    problems.push(`files[] has ${m.files.length} entries (max ${AGENT_LIMITS.maxEntries})`);
  }

  const fileTools = m.workspace?.sdkFileTools === true;
  const allowedSdk: readonly string[] = fileTools
    ? [...AGENT_SDK_TOOLS_ALWAYS, ...AGENT_SDK_TOOLS_FILES]
    : AGENT_SDK_TOOLS_ALWAYS;
  for (const tool of m.sdkTools ?? []) {
    if (!allowedSdk.includes(tool)) {
      problems.push(
        tool === 'Bash'
          ? 'sdkTools may never include "Bash" — installed agents get no shell'
          : `sdkTools "${tool}" is not allowed (allowed: ${allowedSdk.join(', ')})`,
      );
    }
  }

  if (ctx.toolIds) {
    for (const tool of m.tools) {
      if (!ctx.toolIds.includes(tool)) problems.push(`tools "${tool}" is not a registered tool`);
    }
  }
  if (ctx.artifactKinds) {
    for (const kind of m.artifacts ?? []) {
      if (!ctx.artifactKinds.includes(kind)) problems.push(`artifacts "${kind}" is not a known kind`);
    }
  }
  if (ctx.interactionKinds) {
    for (const kind of m.interactions ?? []) {
      if (!ctx.interactionKinds.includes(kind)) {
        problems.push(`interactions "${kind}" is not a known kind`);
      }
    }
  }

  const subagentNames = Object.keys(m.subagents ?? {});
  if (subagentNames.length > AGENT_LIMITS.maxSubagents) {
    problems.push(`subagents: ${subagentNames.length} declared (max ${AGENT_LIMITS.maxSubagents})`);
  }

  if (m.updateUrl && !m.updateUrl.startsWith('https://')) {
    problems.push('updateUrl must be an https URL');
  }

  if (m.starter) {
    problems.push(...validateStarter(m.starter as StarterTree));
  }

  if (problems.length > 0) throw new AgentManifestError(problems);
  return m as AgentManifest;
}
