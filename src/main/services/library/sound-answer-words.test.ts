// E3 fix round 4 (E-d16b) — "which prompt words a library sound covers", the input of the answer's word-diversity
// rule. It re-reads the matcher's four fields (tags, file-name parts, category, description) through the EXPORTED
// `soundTokens` / `matchStrength` / `promptTerms` — the matcher files stay byte-identical to 7967c6f — so this file
// pins the duplication against the matcher itself over the committed 51-clip fixture.
import { describe, expect, it } from 'vitest';
import { CORPUS_LIBRARY } from './sound-match-corpus.fixture';
import { rankLibrarySounds, soundClassOf } from './sound-match';
import { promptSoundWords, wordsCoveredBy } from './sound-answer-words';

const entry = (id: string) => {
  const found = CORPUS_LIBRARY.find((e) => e.relPath === `sfx/${id}.mp3`);
  if (!found) throw new Error(`no fixture clip ${id}`);
  return found;
};

describe('promptSoundWords / wordsCoveredBy (E-d16b)', () => {
  it('the prompt words are promptTerms\' terms — the head and qualifiers, never the placement words', () => {
    expect(promptSoundWords('a sparkling screen')).toEqual(['sparkling', 'screen']);
    expect(promptSoundWords('a whoosh when the slide changes')).toEqual(['whoosh']);
    expect(promptSoundWords('')).toEqual([]);
  });

  it('a word is covered through ANY of the matcher\'s fields at any strength (tag, file name, category, description; equal or stem)', () => {
    const words = promptSoundWords('a sparkling screen');
    expect(wordsCoveredBy(entry('power-down'), words)).toEqual(['screen']); // tag
    expect(wordsCoveredBy(entry('pop-reveal'), words)).toEqual(['sparkling', 'screen']); // description "a tiny subtle sparkle", "on screen"
    expect(wordsCoveredBy(entry('sparkle-soft'), words)).toEqual(['sparkling']); // tag `sparkle`, a stem hit
    expect(wordsCoveredBy(entry('knock-solid'), words)).toEqual([]);
    // the "a clicking screen" limit: power-down's description "one soft click" covers `clicking`
    expect(wordsCoveredBy(entry('power-down'), promptSoundWords('a clicking screen'))).toEqual(['clicking', 'screen']);
    // a negated word never counts (`soundTokens` drops it): flame-snuff says "no whoosh"
    expect(wordsCoveredBy(entry('flame-snuff'), promptSoundWords('a whoosh'))).toEqual([]);
  });

  it('agrees with the matcher: every clip it scores covers ≥ 1 prompt word, every candidate it does not score covers none', () => {
    const prompts = [
      'a sparkling screen', 'a whooshing screen', 'a clicking screen', 'a cracked screen', 'a scribbled note', 'a soft knocking',
      'running water', 'a breaking screen', 'a moving transition', 'a soft airy whoosh for a transition', 'a door shutting',
      'a typed message when the text appears', 'a zapped device', 'a pulsing bed', 'a warm bed for a cooking show',
    ];
    for (const prompt of prompts) {
      const soundClass = prompt.includes(' bed') ? 'music' : 'sfx';
      const words = promptSoundWords(prompt);
      const r = rankLibrarySounds(CORPUS_LIBRARY, prompt, { soundClass, limit: CORPUS_LIBRARY.length });
      const scored = new Set([...r.matches, ...r.nearest].map((m) => m.entry.relPath));
      for (const e of CORPUS_LIBRARY) {
        const cls = soundClassOf(e);
        if (cls !== 'either' && cls !== soundClass) continue;
        expect({ prompt, clip: e.relPath, covers: wordsCoveredBy(e, words).length > 0 }).toEqual({ prompt, clip: e.relPath, covers: scored.has(e.relPath) });
      }
    }
  });
});
