import { describe, expect, it } from 'vitest';
import { parseThread, threadVersionPath, visibleTurns, type ThreadTurn } from './project-thread';

// chat.json as the Creator's thread: every writer's turns, the version each
// reply saved (stored by builder jobs, read from the text for older ones).

describe('parseThread', () => {
  it("reads a builder's turns with their version and summary", () => {
    const raw = JSON.stringify([
      { role: 'user', content: 'A red ball bounces.', timestamp: 't1' },
      { role: 'assistant', content: 'Built v1 (quick, 1 round, finished).', timestamp: 't1', version: 1, summary: '  Red ball drops; squash at 60.  ' },
    ]);
    expect(parseThread(raw)).toEqual([
      { role: 'user', content: 'A red ball bounces.', timestamp: 't1', version: null },
      { role: 'assistant', content: 'Built v1 (quick, 1 round, finished).', timestamp: 't1', version: 1, summary: 'Red ball drops; squash at 60.' },
    ]);
  });

  it('reads the version from the text of older replies (pipeline, Studio)', () => {
    const turns = parseThread(JSON.stringify([
      { role: 'assistant', content: 'Generated v1.tsx (tsx mode).' },
      { role: 'assistant', content: 'Applied edit — saved as v12.tsx.' },
      { role: 'user', content: 'Refine pass — stills critique of v3' },
      { role: 'assistant', content: 'Done.' },
    ]));
    expect(turns.map((t) => t.version)).toEqual([1, 12, null, null]);
  });

  it('is empty for a missing, broken or foreign file, and skips bad turns', () => {
    expect(parseThread(null)).toEqual([]);
    expect(parseThread('{not json')).toEqual([]);
    expect(parseThread('{"role":"user"}')).toEqual([]);
    expect(parseThread(JSON.stringify([null, { role: 'system', content: 'x' }, { role: 'user', content: 3 }, { role: 'user', content: 'ok' }])))
      .toEqual([{ role: 'user', content: 'ok', version: null }]);
  });
});

describe('visibleTurns', () => {
  const turns: ThreadTurn[] = Array.from({ length: 5 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `t${i}`, version: null }));

  it('shows the latest exchange and counts the rest', () => {
    expect(visibleTurns(turns, false)).toEqual({ shown: turns.slice(3), hidden: 3 });
    expect(visibleTurns(turns, true)).toEqual({ shown: turns, hidden: 0 });
    expect(visibleTurns(turns.slice(0, 2), false)).toEqual({ shown: turns.slice(0, 2), hidden: 0 });
  });
});

describe('threadVersionPath', () => {
  it("uses the library's own path when it lists the version", () => {
    expect(threadVersionPath('C:\\lib\\bounce', 2, ['C:\\lib\\bounce\\v1.tsx', 'C:\\lib\\bounce\\v2.tsx'])).toBe('C:\\lib\\bounce\\v2.tsx');
    expect(threadVersionPath('C:/lib/bounce', 12, ['C:/lib/bounce/v2.tsx', 'C:/lib/bounce/v12.tsx'])).toBe('C:/lib/bounce/v12.tsx');
  });

  it("builds it with the folder's separator otherwise", () => {
    expect(threadVersionPath('C:\\lib\\bounce', 3, [])).toBe('C:\\lib\\bounce\\v3.tsx');
    expect(threadVersionPath('C:/lib/bounce/', 3, [])).toBe('C:/lib/bounce/v3.tsx');
  });
});
