// E3 fix round 2 — the matcher's words: same word by known inflections only (F2), placement words as a bonus,
// and a leading placement clause without a comma.
import { describe, expect, it } from 'vitest';
import { headWord, promptTerms, wordStem, wordsMatch } from './sound-match-words';

describe('wordsMatch — known English inflections only (F2)', () => {
  it.each([
    ['air', 'airy'], ['whoosh', 'whooshes'], ['whoosh', 'whooshing'], ['tick', 'ticking'], ['tick', 'ticks'],
    ['pop', 'popping'], ['click', 'clicks'], ['riser', 'risers'], ['close', 'closes'], ['closes', 'closing'],
    ['closed', 'close'], ['flies', 'flying'], ['fly', 'flies'], ['switch', 'switches'], ['appear', 'appears'],
    ['slide', 'sliding'], ['run', 'runs'], ['run', 'running'], ['ring', 'ringing'], ['play', 'playing'], ['play', 'plays'],
    ['speed', 'speeds'], ['glass', 'glasses'], ['chime', 'chiming'], ['zip', 'zippy'], ['gentle', 'gently'],
  ])('%s = %s', (a, b) => {
    expect(wordsMatch(a, b)).toBe(true);
    expect(wordsMatch(b, a)).toBe(true);
  });

  it.each([
    ['rung', 'run'], ['sparkle', 'spark'], ['riser', 'rise'], ['shutter', 'shut'], ['timer', 'time'], ['doorbell', 'door'],
    ['speed', 'spe'], ['string', 'str'], ['ui', 'uis'],
  ])('%s ≠ %s', (a, b) => {
    expect(wordsMatch(a, b)).toBe(false);
  });

  it('a stem keeps three letters and a vowel; ll / ss / zz / ff stay doubled', () => {
    expect(wordStem('popping')).toBe('pop');
    expect(wordStem('buzzing')).toBe('buzz');
    expect(wordStem('falling')).toBe('fall');
    expect(wordStem('string')).toBe('string');
    expect(wordStem('red')).toBe('red');
  });
});

describe('promptTerms — placement words are a bonus, never coverage', () => {
  it('a placement clause gives bonus words; the sound words keep their weights', () => {
    const t = promptTerms('a snap when the trap closes');
    expect(t.terms).toEqual([{ word: 'snap', weight: 1 }]);
    expect(t.bonus).toEqual(['trap', 'closes']);
    expect(t.head).toBe('snap');
  });

  it('particles are never a bonus ("slides out" must not lift a `drawn-out` tag)', () => {
    expect(promptTerms('a quick swoosh as the title slides out').bonus).toEqual(['title', 'slides']);
  });

  it('a leading placement clause WITHOUT a comma: the sound from the last "a" / "an", placement words at half weight', () => {
    const t = promptTerms('when the logo lands a deep impact hit');
    expect(t.head).toBe('hit');
    expect(t.terms).toEqual([
      { word: 'deep', weight: 1 }, { word: 'impact', weight: 1 }, { word: 'hit', weight: 1 },
      { word: 'logo', weight: 0.5 }, { word: 'lands', weight: 0.5 },
    ]);
    expect(t.bonus).toEqual([]);
    expect(headWord('as the title appears a soft whoosh')).toBe('whoosh');
    expect(headWord('if the answer is right a chime')).toBe('chime');
  });

  it('a prompt that is only a placement word has no sound', () => {
    expect(promptTerms('once').terms).toEqual([]);
    expect(promptTerms('until').terms).toEqual([]);
    expect(headWord('when the logo lands')).toBe('lands');
  });
});
