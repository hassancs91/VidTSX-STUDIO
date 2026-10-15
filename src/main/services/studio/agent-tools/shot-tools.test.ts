// generate_tsx_shot on the TSX builder (P3 part 5): the chip follows the
// build's progress, the result carries the builder's last look (D6), the
// budget reaches the generator, and a shot cancelled from the pool ends the
// call as "cancelled", not as a failure.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioToolContext } from './types';

vi.mock('electron', () => ({ app: { getPath: () => '.', isPackaged: false, getAppPath: () => '.' }, nativeImage: {} }));
const { generate, ShotCancelledError } = vi.hoisted(() => {
  class ShotCancelledError extends Error {}
  return { generate: vi.fn(), ShotCancelledError };
});
vi.mock('../shot-generator', () => ({ shotGenerator: { generate }, ShotCancelledError }));
vi.mock('../../agents/tools/composition-build', () => ({
  readResultImages: async (picked: Array<{ path: string }>) => ({
    stills: picked,
    images: picked.map((s) => ({ data: `IMG:${s.path}`, mimeType: 'image/jpeg' })),
  }),
}));

const { buildShotTools } = await import('./shot-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ type: string; text?: string; data?: string }>; isError?: boolean }>;
}

function makeCtx(signal = new AbortController().signal) {
  const events: Array<Record<string, unknown>> = [];
  const ctx = {
    req: { projectId: 'p1', assets: [{ id: 'talk' }], shots: [], reviewOpen: false, model: 'claude-sonnet-5-5' },
    signal,
    emit: (e: Record<string, unknown>) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const tools = Object.fromEntries((buildShotTools(ctx) as unknown as ToolLike[]).map((t) => [t.name, t]));
  return { ctx, events, tools };
}

const still = (frame: number, look = 'r02', size = 'model') => ({ round: 2, frame, size, path: `C:/s/v1.stills/${look}-f${frame}.jpg` });

beforeEach(() => {
  generate.mockReset();
});

describe('generate_tsx_shot', () => {
  it('builds at the asked budget, shows each progress line, and returns the last look', async () => {
    generate.mockImplementation(async (req: { onProgress: (m: string, p: number) => void }) => {
      req.onProgress('Waiting for another build to finish', 0);
      req.onProgress('Round 1/3 · Rendering frames', 40);
      return {
        shot: { id: 'live-badge', kind: 'overlay', activeVersion: 1, status: 'ready', config: { durationInFrames: 150, fps: 30, width: 1920, height: 1080 } },
        build: {
          budget: 'quick', round: 1, checks: 3, finished: true, summary: 'A red LIVE pill.',
          stills: [still(0, 'r01'), still(0), still(75), still(149), still(0, 'phone1', 'phone')],
        },
      };
    });
    const { events, tools } = makeCtx();
    const res = await tools.generate_tsx_shot.handler({ kind: 'overlay', brief: 'A LIVE badge.', budget: 'quick' }, {});
    expect(generate.mock.calls[0][0]).toMatchObject({ projectId: 'p1', kind: 'overlay', budget: 'quick', model: 'claude-sonnet-5-5', origin: { by: 'agent' } });
    expect(events.filter((e) => e.kind === 'progress')).toEqual([
      { projectId: 'p1', kind: 'progress', tool: 'generate_tsx_shot', message: 'Waiting for another build to finish', percent: 0 },
      { projectId: 'p1', kind: 'progress', tool: 'generate_tsx_shot', message: 'Round 1/3 · Rendering frames', percent: 40 },
    ]);
    expect(res.isError).toBeUndefined();
    const text = res.content[0].text!;
    expect(text).toMatch(/^Shot ready: id "live-badge" \(overlay, 5\.0 s, v1\)\./);
    expect(text).toContain('Built on Quick: 1 look, 3 checks, finished.');
    expect(text).toContain("Builder's summary: A red LIVE pill.");
    expect(text).toContain('frames 0, 75 and 149 from its last look');
    expect(text).toContain('call propose_shots ONCE');
    expect(res.content.filter((c) => c.type === 'image').map((c) => c.data)).toEqual([
      'IMG:C:/s/v1.stills/r02-f0.jpg',
      'IMG:C:/s/v1.stills/r02-f75.jpg',
      'IMG:C:/s/v1.stills/r02-f149.jpg',
    ]);
  });

  it('says a shot cancelled from the pool was not made, and lets the assistant carry on', async () => {
    generate.mockImplementation(async () => {
      throw new ShotCancelledError('Cancelled');
    });
    const { tools } = makeCtx();
    const res = await tools.generate_tsx_shot.handler({ kind: 'cutaway', brief: 'Stats.' }, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toMatch(/cancelled from the shot pool/);
  });

  it('reports a failed build as a tool error', async () => {
    generate.mockImplementation(async () => {
      throw new Error('No build passed check.');
    });
    const { tools } = makeCtx();
    const res = await tools.generate_tsx_shot.handler({ kind: 'cutaway', brief: 'Stats.' }, {});
    expect(res).toMatchObject({ isError: true, content: [{ text: 'Shot generation failed: No build passed check.' }] });
  });
});
