// "Run a flow on this" (flows plan §1.8, W8 Stage 6): the pure half of the
// hand-off — which flows take a video or an image, the payload one card
// builds, the stash/event shape the Flows screen reads, the file-url decode.

import { describe, it, expect } from 'vitest';
import type { FlowParam } from '../types/flows';
import {
  buildFlowHandoff,
  fileUrlToPath,
  handoffParamsFromJson,
  handoffParamsOf,
  handoffTargets,
  isFlowHandoff,
} from './flow-handoff';

const params: FlowParam[] = [
  { id: 'topic', label: 'Topic', kind: 'prompt', bind: [{ nodeId: 'n', key: 'prompt' }] },
  { id: 'video', label: 'Video', kind: 'video', bind: [{ nodeId: 'n', key: 'filePath' }] },
  { id: 'product', label: 'Product image', kind: 'image', bind: [{ nodeId: 'n', key: 'filePath' }] },
];

describe('handoff params', () => {
  it('keeps only image and video params, in order', () => {
    expect(handoffParamsOf(params)).toEqual([
      { id: 'video', kind: 'video', label: 'Video' },
      { id: 'product', kind: 'image', label: 'Product image' },
    ]);
    expect(handoffParamsFromJson(JSON.stringify({ params }))).toHaveLength(2);
    expect(handoffParamsFromJson('nope')).toEqual([]);
    expect(handoffParamsFromJson('{"params":"x"}')).toEqual([]);
  });

  it('lists the targets for one kind, one per (flow, param)', () => {
    const flows = [
      { id: 'vidtsx/frame-strip', name: 'Frame strip', handoffParams: [{ id: 'video', kind: 'video' as const, label: 'Video' }] },
      { id: 'vidtsx/product-ad', name: 'Product ad', handoffParams: [{ id: 'product', kind: 'image' as const, label: 'Product image' }] },
      { id: 'u1', name: 'No media' },
    ];
    expect(handoffTargets(flows, 'video')).toEqual([
      { flowId: 'vidtsx/frame-strip', flowName: 'Frame strip', paramId: 'video', paramLabel: 'Video' },
    ]);
    expect(handoffTargets(flows, 'image').map((t) => t.flowId)).toEqual(['vidtsx/product-ad']);
  });

  it('builds the payload the Flows screen opens with', () => {
    const handoff = buildFlowHandoff({ flowId: 'vidtsx/add-effect', flowName: 'Add effect', paramId: 'video', paramLabel: 'Video' }, 'C:/clips/a.mp4');
    expect(handoff).toEqual({ flowId: 'vidtsx/add-effect', prefill: { video: 'C:/clips/a.mp4' } });
    expect(isFlowHandoff(handoff)).toBe(true);
    expect(isFlowHandoff({ flowId: 'x' })).toBe(true);
    expect(isFlowHandoff({ flowId: '' })).toBe(false);
    expect(isFlowHandoff({ prefill: {} })).toBe(false);
    expect(isFlowHandoff(null)).toBe(false);
  });
});

describe('fileUrlToPath', () => {
  it('turns the Video Studio url shape into an absolute path', () => {
    expect(fileUrlToPath('file:///C:/Users/x/Videos/a b.mp4')).toBe('C:/Users/x/Videos/a b.mp4');
    expect(fileUrlToPath('file:///home/x/a%20b.mp4')).toBe('/home/x/a b.mp4');
    expect(fileUrlToPath('C:/already/a.mp4')).toBe('C:/already/a.mp4');
  });
});
