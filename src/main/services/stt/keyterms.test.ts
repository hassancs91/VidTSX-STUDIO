import { describe, expect, it } from 'vitest';
import type { StudioMemory } from '../../../shared/types/studio-memory';
import { KEYTERMS_MAX, composeKeyterms, extractScriptTerms } from './keyterms';

function memory(overrides: Partial<StudioMemory>): StudioMemory {
  return {
    id: 'm',
    kind: 'vocabulary',
    text: 'LearnWithHasan',
    active: true,
    source: { by: 'user' },
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('extractScriptTerms', () => {
  it('keeps distinctive tokens anywhere, plain capitals only mid-sentence, joins phrases', () => {
    const script =
      'Welcome to VidTSX. Today we render with Remotion inside VidTSX Studio.\n' +
      'Hasan Aboul Hasan built it. The DJI clips are H.264. VidTSX ships soon!';
    const terms = extractScriptTerms(script);
    expect(terms[0]).toBe('VidTSX'); // three mentions, first
    expect(terms).toContain('Remotion');
    expect(terms).toContain('VidTSX Studio');
    expect(terms).toContain('Hasan Aboul Hasan');
    expect(terms).toContain('DJI');
    expect(terms).toContain('H.264');
    expect(terms).not.toContain('Welcome');
    expect(terms).not.toContain('Today');
    expect(terms).not.toContain('The');
  });

  it('is deterministic and respects the cap', () => {
    const script = Array.from({ length: 80 }, (_, i) => `See Name${i} now.`).join(' ');
    const a = extractScriptTerms(script, 10);
    expect(a).toEqual(extractScriptTerms(script, 10));
    expect(a).toHaveLength(10);
    expect(a[0]).toBe('Name0');
    expect(extractScriptTerms('')).toEqual([]);
  });
});

describe('composeKeyterms', () => {
  it('orders brand → memory → script, dedupes case-insensitively, scopes memories by brand', () => {
    const composed = composeKeyterms({
      brandVocabulary: [{ term: 'VidTSX', aliases: ['Vid TSX'] }, { term: 'Acme' }],
      memories: [
        memory({ id: 'a', text: 'LearnWithHasan' }),
        memory({ id: 'b', text: 'vidtsx' }),
        memory({ id: 'c', text: 'OtherBrandName', brandId: 'other' }),
        memory({ id: 'd', text: 'Inactive', active: false }),
        memory({ id: 'e', text: 'AgentOnly', agentId: 'vidtsx/motion-post' }),
        memory({ id: 'f', text: 'Rule text', kind: 'rule' }),
      ],
      brandId: 'acme',
      script: 'Acme uses Remotion. Remotion renders VidTSX shots.',
    });
    expect(composed.keyterms).toEqual(['VidTSX', 'Acme', 'LearnWithHasan', 'Remotion']);
    expect(composed.counts).toEqual({ brand: 2, memory: 1, script: 1 });
  });

  it('never sends aliases (they are the wrong spellings) and caps the list', () => {
    const composed = composeKeyterms({
      brandVocabulary: Array.from({ length: KEYTERMS_MAX + 5 }, (_, i) => ({ term: `T${i}`, aliases: ['bad'] })),
    });
    expect(composed.keyterms).toHaveLength(KEYTERMS_MAX);
    expect(composed.keyterms).not.toContain('bad');
    expect(composeKeyterms({})).toEqual({ keyterms: [], counts: { brand: 0, memory: 0, script: 0 } });
  });
});
