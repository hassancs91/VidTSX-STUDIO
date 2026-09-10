// The Tools hub's Flows group (flows plan §0.1 item 3, W8 Stage 6): only
// built-ins, the two that stand beside a screen first, the hub order kept.

import { describe, it, expect } from 'vitest';
import type { FlowProjectSummary } from '@shared/ipc/types';
import { builtinFlowTools } from './flow-tools';

function row(id: string, name: string, source: FlowProjectSummary['source'] = 'builtin'): FlowProjectSummary {
  return { id, name, description: `${name} desc`, thumbnail: null, galleryFolderId: null, createdAt: 1, updatedAt: 1, docVersion: 2, origin: null, source };
}

describe('builtinFlowTools', () => {
  it('lists the built-ins in the hub order and names the screen each stands beside', () => {
    const cards = builtinFlowTools([
      row('vidtsx/add-effect', 'Add an effect'),
      row('vidtsx/thumbnail', 'Thumbnail'),
      row('01USER', 'Mine', 'user'),
      row('acme/other', 'Other', 'installed'),
      row('vidtsx/frame-strip', 'Frame strip'),
      row('vidtsx/zebra', 'Zebra'),
    ]);
    expect(cards.map((c) => c.flowId)).toEqual(['vidtsx/thumbnail', 'vidtsx/frame-strip', 'vidtsx/add-effect', 'vidtsx/zebra']);
    expect(cards[0]).toEqual({ flowId: 'vidtsx/thumbnail', name: 'Thumbnail', description: 'Thumbnail desc', besides: 'thumbnail-generator' });
    expect(cards[1].besides).toBe('frame-extractor');
    expect(cards[2].besides).toBeUndefined();
  });

  it('is empty without built-ins', () => {
    expect(builtinFlowTools([row('01USER', 'Mine', 'user')])).toEqual([]);
  });
});
