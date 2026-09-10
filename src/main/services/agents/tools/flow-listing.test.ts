// The priced listing `run_flow` carries in its description (flows plan §0.1
// item 6, W8 Stage 4): each flow's params and priced steps with a cost from
// the video catalog, and a text that only changes when a flow does.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { FlowDoc } from '../../../../shared/types/flows';

const flows = vi.hoisted(() => ({ list: [] as Array<{ doc: FlowDoc; updatedAt: number }>, calls: 0 }));

vi.mock('../../flows/flow-service', () => ({
  listFlowDocs: () => {
    flows.calls += 1;
    return flows.list;
  },
  loadFlowDoc: () => {
    throw new Error('not used');
  },
  resolveFlowRef: () => ({ error: 'not used' }),
  flowService: {},
}));

await import('./registry');
const { clearFlowListingCacheForTests, describeFlow, installedFlowsListing, pricedNodesOf, pricedSummary } = await import('./flow-listing');

const ROOT = path.resolve(__dirname, '../../../../../resources/flows/vidtsx');
async function fixture(name: string): Promise<FlowDoc> {
  return JSON.parse(await fs.readFile(path.join(ROOT, name, 'flow.json'), 'utf-8')) as FlowDoc;
}

beforeEach(() => {
  clearFlowListingCacheForTests();
  flows.list = [];
  flows.calls = 0;
});

describe('priced listing', () => {
  it('prices add-effect from its model and duration (Kling 2.5 Turbo Pro, 5 s ≈ $0.40)', async () => {
    const doc = await fixture('add-effect');
    const priced = pricedNodesOf(doc);
    expect(priced).toHaveLength(1);
    expect(priced[0]).toMatchObject({ nodeId: 'n-clip', toolId: 'generate_video', usd: 0.4 });
    expect(priced[0].text).toBe('generate_video (kling-2.5-turbo-pro, 5 s ≈ $0.40)');
    expect(pricedSummary(doc)).toBe('Priced steps: generate_video (kling-2.5-turbo-pro, 5 s ≈ $0.40) — expect about $0.40.');
  });

  it('a flow with no priced node says so', async () => {
    expect(pricedSummary(await fixture('thumbnail'))).toBe('Priced steps: none (LLM turns run on the session provider).');
  });

  it('describes a flow with its id, steps, outputs, priced line and params', async () => {
    const text = describeFlow(await fixture('add-effect'));
    expect(text).toContain('"Add an effect" (id vidtsx/add-effect)');
    expect(text).toContain('steps: input_video_file → input_text → extract_frame → generate_image → generate_video; outputs: Video');
    expect(text).toContain('- video: Video (video, required, an absolute file path');
    expect(text).toContain('- effect: Effect (prompt, required)');
  });

  it('the listing is one stable string until a flow changes', async () => {
    flows.list = [{ doc: await fixture('thumbnail'), updatedAt: 1 }];
    const first = installedFlowsListing();
    const second = installedFlowsListing();
    expect(second).toBe(first);
    expect(first).toContain('"Thumbnail" (id vidtsx/thumbnail)');
    flows.list = [{ doc: await fixture('thumbnail'), updatedAt: 2 }, { doc: await fixture('add-effect'), updatedAt: 1 }];
    const third = installedFlowsListing();
    expect(third).not.toBe(first);
    expect(third).toContain('"Add an effect"');
    expect(flows.calls).toBe(3);
  });

  it('says so when nothing is installed', () => {
    expect(installedFlowsListing()).toContain('No flows are installed yet');
  });
});
