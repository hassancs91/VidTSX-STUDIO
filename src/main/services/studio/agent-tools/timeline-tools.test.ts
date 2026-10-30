// get_timeline (ASSISTANT_TIMELINE_DESIGN §3) through its real tool handler,
// the project load mocked: the 2-clip answer exact, a load failure and a bad
// window as tool errors, the chip, and the description's anchor + caps.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioProject } from '../../../../shared/types/studio';
import type { StudioToolContext } from './types';

const loadProject = vi.fn();
vi.mock('../project-store', () => ({
  loadProject: (projectId: string) => loadProject(projectId),
}));

const { buildTimelineTools } = await import('./timeline-tools');

interface ToolLike {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function makeCtx(): { ctx: StudioToolContext; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'e3v-whoosh', assets: [], reviewOpen: true },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function getTimelineTool(ctx: StudioToolContext): ToolLike {
  const found = (buildTimelineTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'get_timeline');
  if (!found) throw new Error('get_timeline not built');
  return found;
}

const E3V_ID = 'ed2cde25-2bfe-4005-a544-adced7e5299c';

function twoClipProject(): StudioProject {
  return {
    schemaVersion: 1,
    id: 'e3v-whoosh',
    name: 'e3v-whoosh',
    settings: { width: 1280, height: 720, fps: 30, agent: {} },
    assets: [
      {
        id: E3V_ID,
        kind: 'video',
        path: 'C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\search\\S4\\r1\\media\\e3v-clip.mp4',
        probe: { duration: 8, width: 640, height: 360, fps: 30, hasAudio: true, codec: 'h264' },
      },
    ],
    timeline: {
      tracks: [
        {
          id: 'v1', kind: 'video', name: 'V1',
          clips: [
            { id: 'e3v-c1', kind: 'video', assetId: E3V_ID, timelineStart: 0, duration: 3, sourceIn: 0 },
            { id: 'e3v-c2', kind: 'video', assetId: E3V_ID, timelineStart: 3, duration: 3, sourceIn: 4 },
          ],
        },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
    proposals: [],
    shots: [],
  } as unknown as StudioProject;
}

beforeEach(() => {
  loadProject.mockReset();
});

describe('get_timeline', () => {
  it('answers the 2-clip project exactly, read from the saved project, while a review is open', async () => {
    loadProject.mockResolvedValue(twoClipProject());
    const { ctx, events } = makeCtx();
    const res = await getTimelineTool(ctx).handler({}, {});
    expect(loadProject).toHaveBeenCalledWith('e3v-whoosh');
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toBe(
      [
        'Timeline 0:06.00 · master track "V1" (video): 2 clips · 1 cut. Times are timeline M:SS.ss; "src" is seconds into the asset.',
        'V1 (master track):',
        '  #1 0:00.00–0:03.00 "e3v-clip.mp4" (video) src 0.00–3.00',
        '  #2 0:03.00–0:06.00 "e3v-clip.mp4" (video) src 4.00–7.00 ← cut 1 at 0:03.00',
        'A1 (audio): empty',
        'Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.',
      ].join('\n'),
    );
    expect(events).toEqual([expect.objectContaining({ kind: 'tool', tool: 'get_timeline' })]);
  });

  it('a load failure is a tool error', async () => {
    loadProject.mockRejectedValue(new Error('ENOENT: no such file'));
    const { ctx } = makeCtx();
    const res = await getTimelineTool(ctx).handler({}, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Could not read the timeline: ENOENT: no such file');
  });

  it('a window passes through; a bad window is a tool error', async () => {
    loadProject.mockResolvedValue(twoClipProject());
    const { ctx } = makeCtx();
    const tool = getTimelineTool(ctx);
    const windowed = await tool.handler({ fromSec: 3.5 }, {});
    expect(windowed.content[0].text.split('\n').slice(1, 4)).toEqual([
      'Showing 0:03.50–the end; cut numbers count from the start of the timeline.',
      'V1 (master track):',
      '  #2 0:03.00–0:06.00 "e3v-clip.mp4" (video) src 4.00–7.00 ← cut 1 at 0:03.00',
    ]);
    const bad = await tool.handler({ fromSec: 4, toSec: 2 }, {});
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toBe('toSec must be after fromSec (got 4–2).');
  });

  it('its description names the cut anchor and the caps', () => {
    const { ctx } = makeCtx();
    const { description } = getTimelineTool(ctx);
    expect(description).toBe(
      'Read the timeline as it stands: every lane\'s clips in timeline order (start–end, the source span, the asset or shot), the master track\'s cuts numbered from 1 (cut n = the n-th place the picture changes), and gaps. Read it before placing anything relative to the edit — a sound at a cut is insert_asset(at: { cut: n, offset }). Capped at 40 master clips and 20 clips per other lane per answer; fromSec / toSec read a window (cut numbers stay counted from the start).',
    );
    expect(description).toContain('{ cut');
    expect(description).toContain('Capped at 40 master clips and 20 clips per other lane');
  });
});
