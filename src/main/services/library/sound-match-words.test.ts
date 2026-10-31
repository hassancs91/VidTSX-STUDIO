// E3 fix round 2 — the matcher's words: same word by known inflections only (F2), placement words as a bonus,
// and a leading placement clause without a comma. Fix round 3: F3a (a verb-form stem hit is weaker than an equal
// hit), F3b (multi-word openers, leading adverbs, trailing words), F3c (SAME_SOUND on the stem), quantifiers.
import { describe, expect, it } from 'vitest';
import { STEM_STRENGTH, headWord, matchStrength, promptTerms, soundTokens, wordStem, wordsMatch } from './sound-match-words';

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

  it('F3a — a verb-form stem hit is weaker than an equal, plural or -y hit; no match through the silent e alone', () => {
    expect(matchStrength('whoosh', 'whoosh')).toBe(1);
    expect(matchStrength('click', 'clicks')).toBe(1);
    expect(matchStrength('air', 'airy')).toBe(1);
    expect(matchStrength('whoosh', 'whooshy')).toBe(1);
    expect(matchStrength('run', 'running')).toBe(STEM_STRENGTH);
    expect(matchStrength('shut', 'shutting')).toBe(STEM_STRENGTH);
    expect(matchStrength('move', 'moving')).toBe(STEM_STRENGTH);
    expect(matchStrength('tick', 'ticking')).toBe(STEM_STRENGTH);
    expect(matchStrength('pop', 'popped')).toBe(STEM_STRENGTH);
    expect(matchStrength('hop', 'hope')).toBe(0);
    expect(matchStrength('bit', 'bite')).toBe(0);
    expect(matchStrength('rung', 'run')).toBe(0);
    expect(STEM_STRENGTH).toBeLessThan(1);
  });

  it('F3c — the SAME_SOUND map applies on the stem too (swooshing / swooshed / wooshing = whoosh)', () => {
    expect(matchStrength('whoosh', 'swooshing')).toBe(STEM_STRENGTH);
    expect(matchStrength('whoosh', 'swooshed')).toBe(STEM_STRENGTH);
    expect(matchStrength('whoosh', 'wooshing')).toBe(STEM_STRENGTH);
    expect(matchStrength('whoosh', 'swooshy')).toBe(1);
    expect(matchStrength('whoosh', 'swooshes')).toBe(1);
    expect(soundTokens('a softer whoosh')).toEqual(['soft', 'whoosh']);
    expect(soundTokens('a deeper impact')).toEqual(['deep', 'impact']);
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

  it('a leading placement clause WITHOUT a comma: the sound from the last "a" / "an", placement words a bonus (fix round 3)', () => {
    const t = promptTerms('when the logo lands a deep impact hit');
    expect(t.head).toBe('hit');
    expect(t.terms).toEqual([{ word: 'deep', weight: 1 }, { word: 'impact', weight: 1 }, { word: 'hit', weight: 1 }]);
    expect(t.bonus).toEqual(['logo', 'lands']);
    expect(headWord('as the title appears a soft whoosh')).toBe('whoosh');
    expect(headWord('if the answer is right a chime')).toBe('chime');
  });

  it('F3b — multi-word openers start a placement clause like "when"', () => {
    for (const opener of ['every time', 'each time', 'any time', 'the moment', 'the instant', 'the second', 'the exact moment']) {
      const t = promptTerms(`a whoosh ${opener} the slide changes`);
      expect(t.terms, opener).toEqual([{ word: 'whoosh', weight: 1 }]);
      expect(t.bonus, opener).toEqual(['slide', 'changes']);
    }
    expect(promptTerms('every time the slide changes, a whoosh').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
    expect(promptTerms('a whoosh at the moment the slide changes').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
  });

  it('F3b — adverbs before a placement / preposition and trailing words are never the head word nor sound words', () => {
    expect(headWord('a whoosh shortly after the cut')).toBe('whoosh');
    expect(promptTerms('a whoosh shortly after the cut').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
    expect(promptTerms('a whoosh exactly when the slide changes').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
    expect(promptTerms('Add a soft whoosh right at the first cut.').terms).toEqual([{ word: 'soft', weight: 1 }, { word: 'whoosh', weight: 1 }]);
    for (const trailing of ['here', 'now', 'again', 'too', 'later']) expect(promptTerms(`a whoosh ${trailing}`).terms, trailing).toEqual([{ word: 'whoosh', weight: 1 }]);
    expect(promptTerms('could you add a whoosh').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
    expect(soundTokens('Exactly ONE pop.')).toEqual(['pop']);
  });

  it('a quantifier before "of" restarts the head clause: "a bit of static" is static', () => {
    expect(headWord('a bit of static')).toBe('static');
    expect(headWord('a little bit of static')).toBe('static');
    expect(headWord('a kind of whoosh')).toBe('whoosh');
    expect(headWord('a piece of glass breaking')).toBe('breaking');
    expect(promptTerms('a bit of a whoosh').terms).toEqual([{ word: 'whoosh', weight: 1 }]);
  });

  it('a prompt that is only a placement word has no sound', () => {
    expect(promptTerms('once').terms).toEqual([]);
    expect(promptTerms('until').terms).toEqual([]);
    expect(headWord('when the logo lands')).toBe('lands');
  });
});
