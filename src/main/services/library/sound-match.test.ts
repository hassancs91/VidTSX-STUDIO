// E3 — the reuse-before-generate matcher (pure). The fixture is shaped like the
// E4 catalog import (relPath `sfx/<id>.mp3`, the catalog prompt as the
// description, category + tags, usedIn) plus E2 generations and user imports.
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { headWord, matchLibrarySounds, soundClassOf, soundTokens } from './sound-match';

const AT = '2026-10-28T12:00:00.000Z';
function clip(relPath: string, duration: number, description: string, extra: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry {
  return { relPath, origin: 'imported', addedAt: AT, kind: 'audio', description, probe: { duration, hasAudio: true }, ...extra };
}
const sfx = (id: string, category: string | undefined, tags: string[], description: string, duration = 1, usedIn: string[] = []) =>
  clip(`sfx/${id}.mp3`, duration, description, {
    tags,
    ...(category ? { audio: { category, loudnessLufs: -20, peakDbfs: -3, peakKind: 'sample' as const } } : {}),
    ...(usedIn.length > 0 ? { usedIn } : {}),
  });

const LIBRARY: LibraryIndexEntry[] = [
  sfx('whoosh-soft', 'motion', ['whoosh', 'transition', 'cutaway', 'air', 'swipe', 'motion'], 'A short, soft air whoosh for a scene transition. Smooth gentle movement of air in the low-mids, premium and restrained, not aggressive or bright. Quick and clean, no metallic ring, no music.', 0.68, ['v1', 'v2', 'v3']),
  sfx('whoosh-wind', 'motion', ['whoosh', 'wind', 'glide', 'float', 'aerial', 'drawn-out', 'motion'], 'A soft, drawn-out wind whoosh for a gliding transition. Smooth airy sustained movement of air, gentle and premium, like floating through the shot. Longer and softer than a quick whoosh, no aggression, no metallic ring, no music.', 2.2, ['v2']),
  sfx('whoosh-reverse', 'motion', ['whoosh', 'reverse', 'rewind', 'backwards', 'suck', 'motion'], 'A soft reversed air whoosh, like time rewinding: a smooth backwards-sucking sweep that rises and cuts off cleanly. Restrained and premium, low-mids, no metallic ring, no music.', 1.1),
  sfx('whoosh-data-burst', 'motion', ['whoosh', 'data', 'speed', 'fast', 'stream', 'ai-working', 'digital', 'motion'], 'A fast, clean digital data whoosh: a quick soft airy swoosh carrying a rapid flurry of tiny soft ticks streaming past, like lines of data flying by at high speed, then gone. Premium and modern, smooth, about one second, ends cleanly. No static, no glitch stutter, no beeps, no bass hit, no music, no voices.', 1.0),
  sfx('dash-zip', 'motion', ['dash', 'run', 'zip', 'sprint', 'fast', 'cartoon', 'skid', 'motion'], 'A small cartoon character dashing past very fast: a quick zippy whoosh with a light flurry of tiny rapid footsteps, ending in a short soft skid stop on a floor, playful but clean, about one second. No voices, no music, no boing, no slide whistle.', 1.0),
  sfx('riser-soft', 'tension', ['riser', 'swell', 'build', 'anticipation', 'tension', 'teaser'], 'A short, gentle upward riser building light anticipation. Smooth airy swell, calm and premium, subtle, resolving softly at the top. About one second, not dramatic, not loud, no big hit, no cymbal.', 1.2),
  sfx('ui-click-soft', 'snap', ['ui', 'click', 'menu', 'tick', 'select', 'snap'], 'A soft, short UI click for selecting a menu item. Crisp but gentle, premium app feel, dry, no music.', 0.2, ['v4']),
  sfx('ui-send', 'snap', ['ui', 'send', 'submit', 'swish', 'message', 'snap'], 'A soft, quick message-send confirmation. Subtle airy swish with a light tick, like sending a chat message in a premium app. Very short, understated, dry, no music.', 0.4),
  sfx('chime-reward', 'reward', ['chime', 'reward', 'positive', 'free', 'gift', 'success'], 'A soft positive reward chime, two gentle warm bell notes rising, premium and understated, like unlocking a free gift in a polished app. Short, clean, no long reverb tail, no music bed.', 1.3),
  sfx('chime-magic', 'reward', ['chime', 'magic', 'wonder', 'glockenspiel', 'hope', 'story'], "A gentle magical chime — a soft warm bell and glockenspiel twinkle that gently rises and sparkles, wondrous tender and comforting like a firefly's glow appearing in the dark, delicate, no harshness, no music.", 2.0),
  sfx('clock-tick-soft', 'texture', ['clock', 'tick', 'tock', 'countdown', 'timer', 'chess-clock', 'texture'], 'A soft mechanical chess clock ticking gently: about three calm tick-tock cycles, muted, precise, quiet, close-mic, no bell, no music.', 3.0),
  sfx('wind-soft', 'texture', ['wind', 'breeze', 'trees', 'nature', 'ambient', 'story'], 'A soft gentle breeze moving through trees at dusk — a light airy wind rustling leaves, calm and natural, a little hushed and lonely, no howling, no gusts, no music.', 6.0),
  sfx('impact-soft', 'emphasis', ['impact', 'hit', 'emphasis', 'soft', 'thud', 'underline'], 'A soft, muted impact hit to underline a point. Warm low thud, short decay, restrained, no music.', 0.9),
  sfx('piano-c-maj', undefined, [], 'C major triad (I) — warm electric-piano voicing (no licence recorded in the catalog)', 2.5),
  clip('generated/sfx-a-soft-pop.mp3', 0.5, 'a soft pop', { origin: 'generated', tags: ['pop'], audio: { category: 'emphasis', loudnessLufs: -20 } }),
  clip('audio/boom.wav', 1.2, 'a big whoosh boom'),
  // music: a music/ folder, a generated `music-` name, and an untagged long import
  clip('music/lofi-warm.mp3', 57.05, 'A warm, cozy lo-fi downtempo bed, friendly and relaxed, no vocals.', { tags: ['lofi', 'downtempo', 'warm', 'cozy', 'friendly', 'bed'], audio: { category: 'lofi' } }),
  clip('music/ambient-pad.mp3', 63.03, 'A calm minimal ambient pad bed, premium, no drums.', { tags: ['ambient', 'pad', 'calm', 'minimal', 'no-drums', 'premium', 'bed'], audio: { category: 'ambient' } }),
  clip('generated/music-tech-pulse.mp3', 30, 'a focused tech pulse with an arpeggio', { origin: 'generated', tags: ['tech', 'pulse', 'arp', 'focus', 'bed'], audio: { category: 'tech' } }),
  clip('audio/long-ambience.wav', 95, 'soft whoosh of wind ambience'),
  // not audio: never a sound match
  { relPath: 'clips/b-roll.mp4', origin: 'imported', addedAt: AT, kind: 'video', description: 'a whoosh of a car', probe: { duration: 4, hasAudio: true } },
  { relPath: 'img/whoosh.png', origin: 'imported', addedAt: AT, kind: 'image', description: 'whoosh' },
];

const ids = (prompt: string, soundClass: 'sfx' | 'music' = 'sfx', minDurationSec?: number) =>
  matchLibrarySounds(LIBRARY, prompt, { soundClass, ...(minDurationSec !== undefined ? { minDurationSec } : {}) }).map((m) => m.entry.relPath);

describe('soundTokens / headWord', () => {
  it('lower-cases, drops stop words and short words, joins hyphenated words and keeps their long parts', () => {
    expect(soundTokens('Add a soft UI click for the menu')).toEqual(['soft', 'ui', 'click', 'menu']);
    expect(soundTokens('a warm lo-fi bed, drawn-out')).toEqual(['warm', 'lofi', 'bed', 'drawnout', 'drawn', 'out']);
  });

  it('drops every word a negation governs, up to the next punctuation', () => {
    expect(soundTokens('Quick and clean, no metallic ring, no music.')).toEqual(['quick', 'clean']);
    expect(soundTokens('restrained, not aggressive or bright. Smooth')).toEqual(['restrained', 'smooth']);
    expect(soundTokens('calm, no-drums, premium')).toEqual(['calm', 'nodrums', 'premium']);
  });

  it('the head word is the last content word of the first clause', () => {
    expect(headWord('a soft cuckoo clock chime, two wooden notes')).toBe('chime');
    expect(headWord('a fast airy whoosh with a short tail')).toBe('whoosh');
    expect(headWord('Add a soft whoosh at the first cut.')).toBe('whoosh');
    expect(headWord('a, the')).toBeUndefined();
  });
});

describe('soundClassOf', () => {
  it('folder / name prefix / tags first, then the probed length', () => {
    const by = (relPath: string) => soundClassOf(LIBRARY.find((e) => e.relPath === relPath) as LibraryIndexEntry);
    expect(by('sfx/whoosh-soft.mp3')).toBe('sfx');
    expect(by('generated/sfx-a-soft-pop.mp3')).toBe('sfx');
    expect(by('music/lofi-warm.mp3')).toBe('music');
    expect(by('generated/music-tech-pulse.mp3')).toBe('music');
    expect(by('audio/boom.wav')).toBe('sfx');
    expect(by('audio/long-ambience.wav')).toBe('music');
    expect(soundClassOf(clip('x/unknown.wav', 0, '', { probe: undefined }))).toBe('either');
  });
});

describe('matchLibrarySounds — the order on realistic prompts (recorded)', () => {
  it('"a soft airy whoosh for a transition" → whoosh-soft first, three whooshes', () => {
    expect(ids('a soft airy whoosh for a transition')).toEqual([
      'sfx/whoosh-soft.mp3',
      'sfx/whoosh-wind.mp3',
      'sfx/whoosh-data-burst.mp3',
    ]);
  });

  it('"soft whoosh" (the force-case prompt) → whoosh-soft first', () => {
    expect(ids('soft whoosh')[0]).toBe('sfx/whoosh-soft.mp3');
    expect(ids('soft whoosh')).toHaveLength(3);
  });

  it('"a fast airy whoosh with a short tail" → the two FAST whooshes, then whoosh-soft (the after-head clause weighs half)', () => {
    expect(ids('a fast airy whoosh with a short tail')).toEqual([
      'sfx/whoosh-data-burst.mp3',
      'sfx/dash-zip.mp3',
      'sfx/whoosh-soft.mp3',
    ]);
  });

  it('"a gentle swoosh between scenes" → a swoosh is a whoosh; whoosh-soft first', () => {
    expect(soundTokens('a gentle swoosh between scenes')).toEqual(['gentle', 'whoosh', 'scenes']);
    expect(ids('a gentle swoosh between scenes')[0]).toBe('sfx/whoosh-soft.mp3');
  });

  it('"a soft UI click" → ui-click-soft first', () => {
    expect(ids('a soft UI click')[0]).toBe('sfx/ui-click-soft.mp3');
  });

  it('a sound the library does not have → no match (the negative / control)', () => {
    expect(ids('a cuckoo clock chime')).toEqual([]);
    expect(ids('a soft cuckoo clock chime, two wooden notes, playful, no music')).toEqual([]);
    expect(ids('metallic ring')).toEqual([]);
  });

  it('never more than three, never a non-audio entry, never the other class', () => {
    const all = ids('whoosh');
    expect(all.length).toBeLessThanOrEqual(3);
    for (const rel of ids('soft whoosh wind ambience')) {
      expect(rel).not.toMatch(/\.(mp4|png)$|^music\/|music-|long-ambience/);
    }
    expect(ids('soft whoosh wind ambience', 'music')).toEqual(['audio/long-ambience.wav']);
  });

  it('music: "warm lo-fi bed" → lofi-warm; a bed shorter than the asked length is not offered', () => {
    expect(ids('warm lo-fi bed', 'music')).toEqual(['music/lofi-warm.mp3']);
    expect(ids('warm lo-fi bed', 'music', 90)).toEqual([]);
    expect(ids('calm drums', 'music')).toEqual([]);
  });

  it('an empty library or a prompt of stop words matches nothing', () => {
    expect(matchLibrarySounds([], 'soft whoosh', { soundClass: 'sfx' })).toEqual([]);
    expect(ids('a sound effect for the video')).toEqual([]);
  });

  it('ties break on usedIn (proven clips first), then the path', () => {
    const twin = (relPath: string, usedIn: string[]) => clip(relPath, 1, 'a whoosh', { tags: ['whoosh'], usedIn });
    const out = matchLibrarySounds([twin('sfx/a.mp3', []), twin('sfx/b.mp3', ['p1', 'p2']), twin('sfx/c.mp3', [])], 'whoosh', { soundClass: 'sfx' });
    expect(out.map((m) => m.entry.relPath)).toEqual(['sfx/b.mp3', 'sfx/a.mp3', 'sfx/c.mp3']);
  });
});
