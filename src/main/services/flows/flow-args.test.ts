// Ports → args and result → ports (flows plan §1.2), pure.

import { describe, it, expect } from 'vitest';
import type { AgentArtifact } from '../../../shared/types/agents';
import type { FlowNode, FlowParam, ToolPorts } from '../../../shared/types/flows';
import { buildNodeArgs, mapOutputs, portValueToArg, type NodeOutputs } from './flow-args';

const ports: ToolPorts = {
  category: 'image',
  configSchema: [],
  defaultConfig: {},
  inputs: [
    { id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' },
    { id: 'sourceImage', label: 'Source', dataType: 'image', argKey: 'sourceImage' },
    { id: 'referenceImages', label: 'References', dataType: 'images', argKey: 'referenceImages' },
  ],
  outputs: [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }],
};

const node: FlowNode = {
  id: 'n-gen',
  toolId: 'generate_image',
  position: { x: 0, y: 0 },
  config: { providerId: 'fal', model: 'seedream', width: 1024, height: 1024, prompt: 'from config' },
  pause: false,
};

const outputs = new Map<string, NodeOutputs>([
  ['n-prompt', { text: { kind: 'text', value: 'a red fox' } }],
  ['n-ref-1', { image: { kind: 'artifact', artifactId: 'image-set-1', artifactKind: 'image-set' } }],
  ['n-ref-2', { image: { kind: 'artifact', artifactId: 'image-set-2', artifactKind: 'image-set' } }],
  ['n-src', { image: { kind: 'artifact', artifactId: 'image-set-3', artifactKind: 'image-set' } }],
]);

const edge = (id: string, source: string, sourceHandle: string, targetHandle: string) => ({
  id,
  source,
  sourceHandle,
  target: 'n-gen',
  targetHandle,
});

describe('buildNodeArgs', () => {
  it('starts from config, lets an edge override, collects images ports into an array', () => {
    const args = buildNodeArgs({
      node,
      ports,
      edges: [
        edge('e1', 'n-prompt', 'text', 'prompt'),
        edge('e2', 'n-ref-1', 'image', 'referenceImages'),
        edge('e3', 'n-ref-2', 'image', 'referenceImages'),
        edge('e4', 'n-src', 'image', 'sourceImage'),
      ],
      outputs,
      params: [],
      paramValues: {},
    });
    expect(args).toEqual({
      providerId: 'fal',
      model: 'seedream',
      width: 1024,
      height: 1024,
      prompt: 'a red fox',
      sourceImage: 'image-set-3',
      referenceImages: ['image-set-1', 'image-set-2'],
    });
  });

  it('a bound run param overrides config, and an edge overrides the param', () => {
    const params: FlowParam[] = [
      { id: 'topic', label: 'Topic', kind: 'prompt', bind: [{ nodeId: 'n-gen', key: 'prompt' }] },
      { id: 'size', label: 'Size', kind: 'number', bind: [{ nodeId: 'n-gen', key: 'width' }, { nodeId: 'n-other', key: 'x' }] },
    ];
    const fromParam = buildNodeArgs({ node, ports, edges: [], outputs, params, paramValues: { topic: 'from param', size: 512 } });
    expect(fromParam).toMatchObject({ prompt: 'from param', width: 512 });
    expect(fromParam).not.toHaveProperty('x');

    const fromEdge = buildNodeArgs({
      node,
      ports,
      edges: [edge('e1', 'n-prompt', 'text', 'prompt')],
      outputs,
      params,
      paramValues: { topic: 'from param' },
    });
    expect(fromEdge.prompt).toBe('a red fox');
    // An unset param leaves the config value alone.
    expect(buildNodeArgs({ node, ports, edges: [], outputs, params, paramValues: {} }).prompt).toBe('from config');
  });

  it('ignores an edge whose upstream has not produced that handle', () => {
    const args = buildNodeArgs({
      node,
      ports,
      edges: [edge('e1', 'n-prompt', 'missing', 'prompt'), edge('e2', 'n-ghost', 'text', 'prompt')],
      outputs,
      params: [],
      paramValues: {},
    });
    expect(args.prompt).toBe('from config');
  });

  it('portValueToArg hands the id for artifacts and the primitive otherwise', () => {
    expect(portValueToArg({ kind: 'artifact', artifactId: 'video-2', artifactKind: 'video' })).toBe('video-2');
    expect(portValueToArg({ kind: 'text', value: 'hi' })).toBe('hi');
    expect(portValueToArg({ kind: 'number', value: 3 })).toBe(3);
  });
});

describe('mapOutputs', () => {
  const artifact = {
    id: 'image-set-4',
    kind: 'image-set' as const,
    title: 'x',
    createdAt: 'now',
    producer: { tool: 'generate_image', callId: 'c' },
    payload: { items: [] },
  };

  it('puts the filed artifact on artifact ports and result fields on field ports', () => {
    const textPorts: Pick<ToolPorts, 'outputs'> = {
      outputs: [
        { id: 'text', label: 'Text', dataType: 'text', from: 'field:text' },
        { id: 'count', label: 'Count', dataType: 'number', from: 'field:count' },
        { id: 'image', label: 'Image', dataType: 'image' },
      ],
    };
    const mapped = mapOutputs(textPorts, { content: [], fields: { text: 'hello', count: 2 } }, artifact);
    expect(mapped).toEqual({
      text: { kind: 'text', value: 'hello' },
      count: { kind: 'number', value: 2 },
      image: { kind: 'artifact', artifactId: 'image-set-4', artifactKind: 'image-set' },
    });
  });

  it('leaves a port out when its source is absent', () => {
    expect(mapOutputs(ports, { content: [] }, null)).toEqual({});
    expect(mapOutputs({ outputs: [{ id: 't', label: 'T', dataType: 'text', from: 'field:t' }] }, { content: [] }, artifact)).toEqual({});
  });
});

describe('W8 Stage 3: videos ports and artifact kinds on output ports', () => {
  it('a videos port collects every incoming edge like images does', () => {
    const node: FlowNode = { id: 'n-join', toolId: 'concat_videos', position: { x: 0, y: 0 }, config: {}, pause: false };
    const outputs = new Map<string, NodeOutputs>([
      ['n-a', { video: { kind: 'artifact', artifactId: 'video-1', artifactKind: 'video' } }],
      ['n-b', { video: { kind: 'artifact', artifactId: 'video-2', artifactKind: 'video' } }],
    ]);
    const args = buildNodeArgs({
      node,
      ports: { inputs: [{ id: 'videos', label: 'V', dataType: 'videos', argKey: 'videos' }] },
      edges: [
        { id: 'e1', source: 'n-a', sourceHandle: 'video', target: 'n-join', targetHandle: 'videos' },
        { id: 'e2', source: 'n-b', sourceHandle: 'video', target: 'n-join', targetHandle: 'videos' },
      ],
      outputs,
      params: [],
      paramValues: {},
    });
    expect(args).toEqual({ videos: ['video-1', 'video-2'] });
  });

  it('a filed artifact lands only on the output ports of its kind', () => {
    const ports = {
      outputs: [
        { id: 'video', label: 'V', dataType: 'video' as const, from: 'artifact' as const },
        { id: 'image', label: 'I', dataType: 'image' as const, from: 'artifact' as const },
        { id: 'transcript', label: 'T', dataType: 'transcript' as const, from: 'artifact' as const },
      ],
    };
    const video: AgentArtifact = {
      id: 'video-3', kind: 'video', title: 'v', createdAt: '', producer: { tool: 't', callId: 'c' }, payload: { relPath: 'a.mp4', durationSeconds: 1 },
    };
    expect(mapOutputs(ports, { content: [] }, video)).toEqual({ video: { kind: 'artifact', artifactId: 'video-3', artifactKind: 'video' } });
    const doc: AgentArtifact = {
      id: 'document-1', kind: 'document', title: 'd', createdAt: '', producer: { tool: 't', callId: 'c' }, payload: { relPath: 't.md' },
    };
    expect(mapOutputs(ports, { content: [] }, doc)).toEqual({ transcript: { kind: 'artifact', artifactId: 'document-1', artifactKind: 'document' } });
  });
});
