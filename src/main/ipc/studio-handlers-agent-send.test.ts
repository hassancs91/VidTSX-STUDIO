// Assistant timeline read §4 / §8.1 3 (T4, verifier mutant M22): the request's
// `timelineCuts` reaches the cuts line of the system prompt that
// handleStudioAgentSend builds. `studioAgent` is mocked — the test captures
// the prompt-builder callback the handler hands it and calls it; the prompt
// builder itself is the real one. (The mock also cuts the handler's only
// import path to `stream/promises`, which a node_modules-less worktree cannot
// resolve — ruling LS-r1c.)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import type { StudioAgentSendRequest, StudioAgentSendResponse } from '../../shared/ipc/types';

type PromptBuilder = (toolsAvailable: boolean) => string;

const { send } = vi.hoisted(() => ({
  send: vi.fn<(req: StudioAgentSendRequest, build: PromptBuilder) => Promise<StudioAgentSendResponse>>(),
}));

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => '' }, dialog: {}, shell: {} }));
vi.mock('../services/studio/studio-agent', () => ({ studioAgent: { send, cancel: vi.fn() } }));

import { handleStudioAgentSend } from './studio-handlers';

const event = {} as IpcMainInvokeEvent;

// The 2-clip project (e3v-whoosh): V1 = two 3 s clips, one cut at 3.00.
const REQ: StudioAgentSendRequest = {
  projectId: 'e3v-whoosh',
  projectName: 'e3v-whoosh',
  prompt: 'Add a soft whoosh at the first cut.',
  history: [],
  assets: [],
  shots: [],
  reviewOpen: false,
  timelineDurationSeconds: 6,
};

/** Runs the handler and returns the system prompt its callback builds. */
async function promptBuiltFor(req: StudioAgentSendRequest): Promise<string> {
  const res = await handleStudioAgentSend(event, req);
  expect(res).toEqual({ success: true, text: 'ok' });
  expect(send).toHaveBeenCalledTimes(1);
  const [passed, build] = send.mock.calls[0];
  expect(passed).toBe(req);
  return build(true);
}

function lineAfterTimeline(prompt: string): string {
  const lines = prompt.split('\n');
  const at = lines.indexOf('- Timeline: 0:06 long.');
  expect(at).toBeGreaterThan(0);
  return lines[at + 1];
}

describe('handleStudioAgentSend — the request\'s timelineCuts reach the cuts line (M22)', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ success: true, text: 'ok' });
  });

  it('2 clips · 1 cut → the cuts line right after "- Timeline: …"', async () => {
    const prompt = await promptBuiltFor({
      ...REQ,
      timelineCuts: { trackName: 'V1', clipCount: 2, gapCount: 0, cuts: [3] },
    });
    expect(lineAfterTimeline(prompt)).toBe('- V1 (master track): 2 clips · 1 cut — cut 1 at 0:03.00.');
  });

  it('no timelineCuts on the request → no cuts line (Captions follows Timeline)', async () => {
    const prompt = await promptBuiltFor(REQ);
    expect(lineAfterTimeline(prompt)).toBe('- Captions: none set.');
    expect(prompt).not.toContain('(master track)');
  });
});
