import { describe, it, expect } from 'vitest';
import type { StudioAgentEvent } from '../../../../shared/ipc/types/studio';
import type { StudioTool, StudioToolContext } from './types';
import { TOOL_RESULT_CAP, capText, withToolResultEvents } from './tool-result-events';

function context(): { ctx: StudioToolContext; events: StudioAgentEvent[] } {
  const events: StudioAgentEvent[] = [];
  const ctx = {
    req: { projectId: 'p1' },
    emit: (event: StudioAgentEvent) => events.push(event),
  } as unknown as StudioToolContext;
  return { ctx, events };
}

const fakeTool = (handler: StudioTool['handler']): StudioTool =>
  ({ name: 'get_transcript', description: '', inputSchema: {}, handler }) as unknown as StudioTool;

describe('withToolResultEvents', () => {
  it('emits the arguments and the text of the result after the tool runs', async () => {
    const { ctx, events } = context();
    const [wrapped] = withToolResultEvents(ctx, [
      fakeTool(async () => ({ content: [{ type: 'text', text: 'words: 12' }, { type: 'image', data: '', mimeType: 'image/png' }] })),
    ]);
    const result = await wrapped.handler({ assetId: 'a1' } as never, {});
    expect(result.content[0]).toEqual({ type: 'text', text: 'words: 12' });
    expect(events).toEqual([
      {
        projectId: 'p1',
        kind: 'tool-result',
        tool: 'get_transcript',
        args: '{\n  "assetId": "a1"\n}',
        result: 'words: 12\n[image]',
      },
    ]);
  });

  it('flags an error result and a thrown error, and rethrows the latter', async () => {
    const { ctx, events } = context();
    const [soft, hard] = withToolResultEvents(ctx, [
      fakeTool(async () => ({ content: [{ type: 'text', text: 'no transcript' }], isError: true })),
      fakeTool(async () => {
        throw new Error('boom');
      }),
    ]);
    await soft.handler({} as never, {});
    await expect(hard.handler({} as never, {})).rejects.toThrow('boom');
    expect(events.map((e) => (e.kind === 'tool-result' ? [e.result, e.isError] : null))).toEqual([
      ['no transcript', true],
      ['boom', true],
    ]);
  });

  it('caps long results and says how much was dropped', () => {
    const capped = capText('x'.repeat(TOOL_RESULT_CAP + 500), TOOL_RESULT_CAP);
    expect(capped.length).toBeLessThan(TOOL_RESULT_CAP + 60);
    expect(capped.endsWith('… [500 more characters]')).toBe(true);
  });
});
