// `flow.json` — the package manifest rules (flows plan §1.7, W8 Stage 6):
// the document half through the structural validator, the package half
// through the agents' container rules, `requires.tools` against the registry.

import { describe, it, expect } from 'vitest';
import { AGENT_TOOL_IDS } from '../agents/tool-ids';
import {
  FLOW_LIMITS,
  FlowManifestError,
  flowDocOf,
  graphToolIds,
  looksLikeFlowManifest,
  parseFlowPackageManifest,
  type FlowManifestContext,
} from './flow-package';

function manifest(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 2,
    id: 'acme/captions',
    name: 'Captions',
    description: 'A video, captioned.',
    version: '1.2.0',
    author: { name: 'Acme' },
    minAppVersion: '1.0.0',
    requires: { tools: ['input_video_file', 'transcribe'], capabilities: [] },
    params: [{ id: 'video', label: 'Video', kind: 'video', required: true, bind: [{ nodeId: 'n-video', key: 'filePath' }] }],
    graph: {
      nodes: [
        { id: 'n-video', toolId: 'input_video_file', position: { x: 0, y: 0 }, config: { filePath: '' }, pause: false },
        { id: 'n-stt', toolId: 'transcribe', position: { x: 400, y: 0 }, config: {}, pause: false },
      ],
      edges: [{ id: 'e1', source: 'n-video', sourceHandle: 'video', target: 'n-stt', targetHandle: 'video' }],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-stt', handle: 'transcript', label: 'Transcript' }],
    origin: null,
    files: [],
    ...over,
  };
}

const ctx = { appVersion: '1.1.0', toolIds: AGENT_TOOL_IDS };

function problemsOf(raw: unknown, context: FlowManifestContext = ctx): string[] {
  try {
    parseFlowPackageManifest(raw, context);
    return [];
  } catch (err) {
    if (err instanceof FlowManifestError) return err.problems;
    throw err;
  }
}

describe('parseFlowPackageManifest', () => {
  it('accepts a well-formed manifest and yields the document half', () => {
    const m = parseFlowPackageManifest(manifest(), ctx);
    expect(m.id).toBe('acme/captions');
    expect(m.requires.tools).toEqual(['input_video_file', 'transcribe']);
    const doc = flowDocOf(m);
    expect(doc).toEqual({
      formatVersion: 2,
      id: 'acme/captions',
      name: 'Captions',
      description: 'A video, captioned.',
      params: m.params,
      graph: m.graph,
      outputs: m.outputs,
      origin: null,
    });
    expect((doc as unknown as Record<string, unknown>).version).toBeUndefined();
  });

  it('refuses a ulid id — a packaged flow is namespaced', () => {
    expect(problemsOf(manifest({ id: '01J8ZKEGACYR0W000000000000' }))).toEqual([
      expect.stringMatching(/must be "<namespace>\/<name>"/),
    ]);
  });

  it('refuses an app that is too old, a bad version, a missing author', () => {
    expect(problemsOf(manifest({ minAppVersion: '9.0.0' }))).toEqual([expect.stringMatching(/needs VidTSX 9.0.0/)]);
    expect(problemsOf(manifest({ version: 'one' }))).toEqual([expect.stringMatching(/version must be semver/)]);
    expect(problemsOf(manifest({ author: undefined }))).toEqual([expect.stringMatching(/^author/)]);
  });

  it('requires.tools must list every tool the graph uses, and every one must exist', () => {
    expect(problemsOf(manifest({ requires: { tools: ['input_video_file'], capabilities: [] } }))).toEqual([
      'requires.tools does not list "transcribe", which the graph uses',
    ]);
    expect(problemsOf(manifest({ requires: { tools: ['input_video_file', 'transcribe', 'teleport'], capabilities: [] } }))).toEqual([
      'requires.tools "teleport" is not a registered tool',
    ]);
    // Without a registry (offline, no context) the graph rule still holds.
    expect(problemsOf(manifest({ requires: { tools: [], capabilities: [] } }), {})).toHaveLength(2);
  });

  it('runs the structural gate on the document half', () => {
    const bad = manifest();
    (bad.graph as { edges: unknown[] }).edges = [
      { id: 'e1', source: 'n-video', sourceHandle: 'video', target: 'n-ghost', targetHandle: 'video' },
    ];
    expect(problemsOf(bad)).toEqual([expect.stringMatching(/^graph: .*n-ghost/)]);
    // An empty graph: GRAPH_EMPTY plus the param bind and the output that now point nowhere.
    const empty = problemsOf(manifest({ graph: { nodes: [], edges: [] } }));
    expect(empty.length).toBeGreaterThanOrEqual(1);
    expect(empty.every((p) => p.startsWith('graph: '))).toBe(true);
  });

  it('applies the container rules to files[]', () => {
    const entry = (path: string, size = 4) => ({ path, size, sha256: 'a'.repeat(64) });
    expect(problemsOf(manifest({ files: [entry('../evil.png')] }))).toEqual(['files: unsafe entry path "../evil.png"']);
    expect(problemsOf(manifest({ files: [entry('signature.json')] }))).toEqual([expect.stringMatching(/written by the store/)]);
    expect(problemsOf(manifest({ files: [entry('flow.json')] }))).toEqual([expect.stringMatching(/written by the store/)]);
    expect(problemsOf(manifest({ files: [entry('assets/a.png'), entry('assets/a.png')] }))).toEqual(['files: duplicate entry "assets/a.png"']);
    expect(problemsOf(manifest({ files: [entry('assets/big.png', FLOW_LIMITS.maxEntryBytes + 1)] }))).toEqual([
      expect.stringMatching(/max \d+/),
    ]);
    const third = Math.floor(FLOW_LIMITS.maxTotalBytes / 3) + 1;
    expect(problemsOf(manifest({ files: [entry('a.bin', third), entry('b.bin', third), entry('c.bin', third)] }))).toEqual([
      expect.stringMatching(/bytes total/),
    ]);
    expect(problemsOf(manifest({ icon: 'icon.png' }))).toEqual(['icon "icon.png" is not listed in files[]']);
    expect(problemsOf(manifest({ icon: 'icon.png', files: [entry('icon.png')] }))).toEqual([]);
  });

  it('lists every problem at once', () => {
    const problems = problemsOf(manifest({ id: 'bad id', minAppVersion: '9.0.0', updateUrl: 'http://x' }));
    // The bad id is named twice — by the package rule and by the document gate — plus the version and the url.
    expect(problems).toHaveLength(4);
    expect(problems.filter((p) => p.includes('bad id'))).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('graphToolIds deduplicates in node order', () => {
    const m = parseFlowPackageManifest(manifest(), ctx);
    expect(graphToolIds(m)).toEqual(['input_video_file', 'transcribe']);
  });

  it('looksLikeFlowManifest tells a manifest from a bare document', () => {
    expect(looksLikeFlowManifest(manifest())).toBe(true);
    const { version: _v, requires: _r, ...bare } = manifest();
    expect(looksLikeFlowManifest(bare)).toBe(false);
    expect(looksLikeFlowManifest(null)).toBe(false);
  });
});
