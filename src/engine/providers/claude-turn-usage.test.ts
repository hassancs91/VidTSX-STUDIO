import { describe, expect, it, vi } from 'vitest';
import { TurnUsageTracker } from './claude-turn-usage';
import type { LLMTurnUsage } from '../types';

function tracker() {
  const turns: LLMTurnUsage[] = [];
  return { turns, t: new TurnUsageTracker((u) => turns.push(u)) };
}

const start = (id: string, usage: Record<string, number | null>) => ({
  type: 'message_start',
  message: { id, usage },
});
const delta = (usage: Record<string, number | null>) => ({ type: 'message_delta', usage });

describe('TurnUsageTracker — stream events', () => {
  it('reports each response once, at its message_delta, with the final counts', () => {
    const { turns, t } = tracker();
    t.streamEvent(start('msg_1', { input_tokens: 3, output_tokens: 1, cache_read_input_tokens: 9000, cache_creation_input_tokens: 1200 }));
    // The split assistant messages of the same response carry partial usage: ignored.
    t.assistant({ id: 'msg_1', usage: { input_tokens: 3, output_tokens: 1 } });
    t.assistant({ id: 'msg_1', usage: { input_tokens: 3, output_tokens: 7 } });
    expect(turns).toEqual([]);
    t.streamEvent(delta({ output_tokens: 412, input_tokens: null, cache_read_input_tokens: null }));
    t.streamEvent(start('msg_2', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 10400, cache_creation_input_tokens: 900 }));
    t.streamEvent(delta({ output_tokens: 88 }));
    t.flush();
    expect(turns).toEqual([
      { turn: 1, inputTokens: 3, outputTokens: 412, cacheReadInputTokens: 9000, cacheCreationInputTokens: 1200 },
      { turn: 2, inputTokens: 1, outputTokens: 88, cacheReadInputTokens: 10400, cacheCreationInputTokens: 900 },
    ]);
  });

  it('ignores content-block events and a second delta for the same response', () => {
    const { turns, t } = tracker();
    t.streamEvent(start('msg_1', { input_tokens: 5, output_tokens: 1 }));
    t.streamEvent({ type: 'content_block_delta' });
    t.streamEvent(delta({ output_tokens: 50 }));
    t.streamEvent(delta({ output_tokens: 60 }));
    expect(turns.map((u) => u.outputTokens)).toEqual([50]);
  });

  it('reports a response cut off before its delta when the request ends', () => {
    const { turns, t } = tracker();
    t.streamEvent(start('msg_1', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 100 }));
    t.flush();
    expect(turns).toEqual([{ turn: 1, inputTokens: 5, outputTokens: 1, cacheReadInputTokens: 100, cacheCreationInputTokens: 0 }]);
  });
});

describe('TurnUsageTracker — assistant-message fallback', () => {
  it('reports a response seen only as assistant messages once, with the largest counts, when the next starts', () => {
    const { turns, t } = tracker();
    t.assistant({ id: 'a', usage: { input_tokens: 4, output_tokens: 2, cache_read_input_tokens: 500 } });
    t.assistant({ id: 'a', usage: { input_tokens: 4, output_tokens: 140, cache_read_input_tokens: 500 } });
    expect(turns).toEqual([]);
    t.assistant({ id: 'b', usage: { input_tokens: 1, output_tokens: 30 } });
    expect(turns).toEqual([{ turn: 1, inputTokens: 4, outputTokens: 140, cacheReadInputTokens: 500, cacheCreationInputTokens: 0 }]);
    t.flush();
    t.flush();
    expect(turns.map((u) => [u.turn, u.outputTokens])).toEqual([
      [1, 140],
      [2, 30],
    ]);
  });

  it('starts again from turn 1 after reset (the next request on a hot session)', () => {
    const { turns, t } = tracker();
    t.streamEvent(start('msg_1', {}));
    t.streamEvent(delta({ output_tokens: 10 }));
    t.reset();
    t.streamEvent(start('msg_9', {}));
    t.streamEvent(delta({ output_tokens: 20 }));
    expect(turns.map((u) => [u.turn, u.outputTokens])).toEqual([
      [1, 10],
      [1, 20],
    ]);
  });

  it('survives a throwing listener', () => {
    const emit = vi.fn(() => {
      throw new Error('listener bug');
    });
    const t = new TurnUsageTracker(emit);
    t.streamEvent(start('msg_1', {}));
    expect(() => t.streamEvent(delta({ output_tokens: 1 }))).not.toThrow();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
