import { describe, expect, it } from 'vitest';
import {
  MAX_ACTIVE_RULES,
  MEMORY_PROMPT_BUDGET,
  SHOT_STYLE_PROMPT_BUDGET,
  type StudioMemory,
  type StudioMemoryKind,
} from '../../../shared/types/studio-memory';
import { composeMemoryBlock, composeShotStyleMemory } from './agent-memory-prompt';

let seq = 0;

function mem(
  kind: StudioMemoryKind,
  text: string,
  overrides: Partial<StudioMemory> = {},
): StudioMemory {
  seq += 1;
  const stamp = `2026-01-01T00:00:${String(seq % 60).padStart(2, '0')}.${String(seq).padStart(3, '0')}Z`;
  return {
    id: `id-${String(seq).padStart(3, '0')}`,
    kind,
    text,
    active: true,
    source: { by: 'user' },
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

describe('composeMemoryBlock — scope + shape', () => {
  it('empty set produces no block at all', () => {
    expect(composeMemoryBlock([]).block).toBe('');
    expect(composeMemoryBlock([mem('rule', 'r', { active: false })]).block).toBe('');
  });

  it('renders the spike-tested shape: header, tier sections in order', () => {
    const result = composeMemoryBlock([
      mem('profile', 'AI coding tutorials, 8-15 minutes.'),
      mem('vocabulary', 'LearnWithHasan', { aliases: ['learn with Hassan'] }),
      mem('rule', 'Cut filler tight.'),
    ]);
    expect(result.block).toBe(
      '## How this editor works with you\n\n' +
        'These are things the user told you. Follow them. When you follow one, say ' +
        'which one in your reply ("applied because …").\n\n' +
        '### Rules you have set\n- Cut filler tight.\n\n' +
        '### Names and spellings\n- "LearnWithHasan" (not "learn with Hassan")\n\n' +
        '### About you and your channel\nAI coding tutorials, 8-15 minutes.',
    );
  });

  it('omits sections whose tier has no entries', () => {
    const { block } = composeMemoryBlock([mem('rule', 'Only rules here.')]);
    expect(block).toContain('### Rules you have set');
    expect(block).not.toContain('### Names and spellings');
    expect(block).not.toContain('### About you and your channel');
  });

  it('multi-line rule/vocabulary text renders as one list line; profile keeps paragraphs (D3)', () => {
    const { block } = composeMemoryBlock([
      mem('rule', 'Cut filler tight.\n\n### Fake section'),
      mem('vocabulary', 'Learn\nWith\nHasan'),
      mem('profile', 'Line one.\r\n\r\n\r\n\r\nLine two.'),
    ]);
    expect(block).toContain('- Cut filler tight. ### Fake section');
    expect(block).toContain('- "Learn With Hasan"');
    expect(block).toContain('Line one.\n\nLine two.');
    // The fake header must not have become a real one.
    expect(block).not.toMatch(/^### Fake section/m);
  });

  it('vocabulary renders aliases; entries without aliases render bare', () => {
    const { block } = composeMemoryBlock([
      mem('vocabulary', 'Remotion', { aliases: ['remotion', 'emotion'] }),
      mem('vocabulary', 'VidTSX'),
    ]);
    expect(block).toContain('- "Remotion" (not "remotion", "emotion")');
    expect(block).toMatch(/- "VidTSX"$/);
  });

  it('no-brand memories apply everywhere; branded only on match', () => {
    const memories = [
      mem('rule', 'App-wide rule.'),
      mem('rule', 'Acme-only rule.', { brandId: 'acme' }),
    ];
    const noBrand = composeMemoryBlock(memories);
    expect(noBrand.block).toContain('App-wide rule.');
    expect(noBrand.block).not.toContain('Acme-only rule.');

    const acme = composeMemoryBlock(memories, { brandId: 'acme' });
    expect(acme.block).toContain('App-wide rule.');
    expect(acme.block).toContain('Acme-only rule.');

    const other = composeMemoryBlock(memories, { brandId: 'other' });
    expect(other.block).not.toContain('Acme-only rule.');
  });

  it('inactive memories are excluded, and toggling changes the block deterministically', () => {
    const on = [mem('rule', 'Rule A.'), mem('rule', 'Rule B.')];
    const off = [on[0], { ...on[1], active: false }];
    const withBoth = composeMemoryBlock(on).block;
    const withOne = composeMemoryBlock(off).block;
    expect(withBoth).toContain('Rule B.');
    expect(withOne).not.toContain('Rule B.');
    // Deterministic: same inputs, same bytes.
    expect(composeMemoryBlock(off).block).toBe(withOne);
  });
});

describe('composeMemoryBlock — cache stability (the invariant that silently rots)', () => {
  it('is byte-identical regardless of input array order', () => {
    const memories = [
      mem('profile', 'Profile text.'),
      mem('rule', 'Rule one.'),
      mem('vocabulary', 'Name', { aliases: ['nayme'] }),
      mem('rule', 'Rule two.'),
    ];
    const forward = composeMemoryBlock(memories).block;
    const reversed = composeMemoryBlock([...memories].reverse()).block;
    const shuffled = composeMemoryBlock([memories[2], memories[0], memories[3], memories[1]]).block;
    expect(reversed).toBe(forward);
    expect(shuffled).toBe(forward);
  });

  it('is unchanged when updatedAt differs (only createdAt/id order the block)', () => {
    const memories = [mem('rule', 'Rule one.'), mem('rule', 'Rule two.')];
    const before = composeMemoryBlock(memories).block;
    const touched = memories.map((m) => ({ ...m, updatedAt: '2030-12-31T23:59:59.000Z' }));
    expect(composeMemoryBlock(touched).block).toBe(before);
  });

  it('ties on createdAt fall back to id, so equal timestamps stay deterministic', () => {
    const a = mem('rule', 'Alpha.', { id: 'aaa', createdAt: '2026-01-01T00:00:00.000Z' });
    const b = mem('rule', 'Beta.', { id: 'bbb', createdAt: '2026-01-01T00:00:00.000Z' });
    const one = composeMemoryBlock([b, a]).block;
    const two = composeMemoryBlock([a, b]).block;
    expect(one).toBe(two);
    expect(one.indexOf('Alpha.')).toBeLessThan(one.indexOf('Beta.'));
  });

  it('renders no timestamp anywhere in the output', () => {
    const { block } = composeMemoryBlock([
      mem('rule', 'A rule.'),
      mem('vocabulary', 'Name'),
      mem('profile', 'Profile.'),
    ]);
    expect(block).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('composeMemoryBlock — budget truncation', () => {
  const rule = () => mem('rule', 'R'.repeat(80));
  const vocab = () => mem('vocabulary', 'V'.repeat(40));
  const profile = () => mem('profile', 'P'.repeat(200));

  it('drops profile before vocabulary, and vocabulary from the end of the list', () => {
    const r = rule();
    const v1 = vocab();
    const v2 = vocab();
    const memories = [r, v1, v2, profile()];

    expect(composeMemoryBlock(memories).droppedProfile).toBe(false);

    // Budget = exactly the rules+vocab block: profile alone is dropped.
    const withoutProfile = composeMemoryBlock([r, v1, v2]).block;
    const tight = composeMemoryBlock(memories, { budget: withoutProfile.length });
    expect(tight.block).toBe(withoutProfile);
    expect(tight.droppedProfile).toBe(true);
    expect(tight.droppedVocabulary).toBe(0);
    expect(tight.rulesOverflowBy).toBe(0);

    // Tighter: the LAST vocabulary entry (by creation order) goes first.
    const withOneVocab = composeMemoryBlock([r, v1]).block;
    const tighter = composeMemoryBlock(memories, { budget: withOneVocab.length });
    expect(tighter.block).toBe(withOneVocab);
    expect(tighter.droppedProfile).toBe(true);
    expect(tighter.droppedVocabulary).toBe(1);
    expect(tighter.block).toContain(v1.text);
  });

  it('never drops rules: over-budget rules emit whole and report the overflow', () => {
    const rules = [rule(), rule(), rule()];
    const result = composeMemoryBlock([...rules, vocab(), profile()], { budget: 100 });
    for (const r of rules) expect(result.block).toContain(r.text);
    expect(result.droppedProfile).toBe(true);
    expect(result.droppedVocabulary).toBe(1);
    expect(result.rulesOverflowBy).toBeGreaterThan(0);
    expect(result.block.length - 100).toBe(result.rulesOverflowBy);
  });

  it('never emits a bare header: nothing surviving truncation → empty block (D1)', () => {
    const result = composeMemoryBlock([mem('profile', 'P'.repeat(8000))]);
    expect(result.block).toBe('');
    expect(result.droppedProfile).toBe(true);
    expect(result.rulesOverflowBy).toBe(0);

    const withVocab = composeMemoryBlock(
      [mem('profile', 'P'.repeat(8000)), mem('vocabulary', 'V'.repeat(100))],
      { budget: 50 },
    );
    expect(withVocab.block).toBe('');
    expect(withVocab.droppedVocabulary).toBe(1);
  });

  it('budget coherence: a full rule set at observed max length still fits vocabulary (the 40-vs-2000 test)', () => {
    // Observed rule length in the spike: 60-110 chars. Fill the cap at 110.
    const memories: StudioMemory[] = [];
    for (let i = 0; i < MAX_ACTIVE_RULES; i += 1) {
      memories.push(mem('rule', `${String(i).padStart(3, '0')} ${'r'.repeat(106)}`));
    }
    memories.push(mem('vocabulary', 'LearnWithHasan', { aliases: ['learn with Hassan'] }));
    const result = composeMemoryBlock(memories, { budget: MEMORY_PROMPT_BUDGET });
    expect(result.rulesOverflowBy).toBe(0);
    expect(result.droppedVocabulary).toBe(0);
    expect(result.block).toContain('LearnWithHasan');
  });
});

describe('composeShotStyleMemory — Q6a pipeline injection', () => {
  it('empty or all-inactive set yields null', () => {
    expect(composeShotStyleMemory([]).styleMemory).toBeNull();
    expect(composeShotStyleMemory([mem('rule', 'r', { active: false })]).styleMemory).toBeNull();
  });

  it('takes rules and profile, never vocabulary', () => {
    const result = composeShotStyleMemory([
      mem('vocabulary', 'LearnWithHasan'),
      mem('rule', 'Subtler entrances.'),
      mem('profile', 'AI tutorials channel.'),
    ]);
    expect(result.styleMemory).toEqual({
      rules: ['Subtler entrances.'],
      profile: 'AI tutorials channel.',
    });
  });

  it('brand filter: unscoped always applies, scoped only on match', () => {
    const memories = [
      mem('rule', 'Global rule.'),
      mem('rule', 'Acme rule.', { brandId: 'acme-test' }),
      mem('rule', 'Other-brand rule.', { brandId: 'other' }),
    ];
    expect(composeShotStyleMemory(memories, { brandId: 'acme-test' }).styleMemory?.rules).toEqual([
      'Global rule.',
      'Acme rule.',
    ]);
    expect(composeShotStyleMemory(memories).styleMemory?.rules).toEqual(['Global rule.']);
  });

  it('rules order is createdAt then id, and multi-line text collapses to one line', () => {
    const late = mem('rule', 'Second\nrule.');
    const early = mem('rule', 'First rule.', { createdAt: '2020-01-01T00:00:00.000Z' });
    expect(composeShotStyleMemory([late, early]).styleMemory?.rules).toEqual([
      'First rule.',
      'Second rule.',
    ]);
  });

  it('over budget: profile drops first, rules never dropped and overflow reported', () => {
    const bigProfile = mem('profile', 'p'.repeat(SHOT_STYLE_PROMPT_BUDGET));
    const rule = mem('rule', 'Keep me.');
    const dropped = composeShotStyleMemory([bigProfile, rule]);
    expect(dropped.styleMemory).toEqual({ rules: ['Keep me.'] });
    expect(dropped.droppedProfile).toBe(true);
    expect(dropped.rulesOverflowBy).toBe(0);

    const manyRules = Array.from({ length: 12 }, (_, i) => mem('rule', `${i}-` + 'r'.repeat(280)));
    const overflow = composeShotStyleMemory(manyRules);
    expect(overflow.styleMemory?.rules).toHaveLength(12);
    expect(overflow.rulesOverflowBy).toBeGreaterThan(0);
  });

  it('an oversized profile alone yields null, never an empty section', () => {
    const result = composeShotStyleMemory([mem('profile', 'p'.repeat(SHOT_STYLE_PROMPT_BUDGET + 1))]);
    expect(result.styleMemory).toBeNull();
    expect(result.droppedProfile).toBe(true);
  });
});
