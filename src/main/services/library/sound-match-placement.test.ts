// E3 fix round 1 (verifier round 1, F1) — a placement clause ("when the slide
// changes", "until the reveal", "once the scene switches") must never become the
// sound. The fixture mirrors the REAL imported catalog entries these prompts hit
// (E4 import: relPath `sfx/<id>.mp3`, the catalog prompt as the description,
// category + tags, the catalog's used_in count) plus their nearest distractors.
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { headWord, matchLibrarySounds } from './sound-match';

const AT = '2026-10-28T12:00:00.000Z';
const sfx = (id: string, duration: number, category: string, tags: string[], used: number, description: string): LibraryIndexEntry => ({
  relPath: `sfx/${id}.mp3`, origin: 'imported', addedAt: AT, kind: 'audio', description, tags,
  probe: { duration, hasAudio: true },
  audio: { category, loudnessLufs: -20, peakDbfs: -1.6, peakKind: 'sample' },
  ...(used > 0 ? { usedIn: Array.from({ length: used }, (_, i) => `video-${i}`) } : {}),
});

const CATALOG: LibraryIndexEntry[] = [
  sfx('whoosh-soft', 0.68, 'motion', ['whoosh', 'transition', 'cutaway', 'air', 'swipe', 'motion'], 16, 'A short, soft air whoosh for a scene transition. Smooth gentle movement of air in the low-mids, premium and restrained, not aggressive or bright. Quick and clean, no metallic ring, no music.'),
  sfx('whoosh-wind', 1.2, 'motion', ['whoosh', 'wind', 'glide', 'float', 'aerial', 'drawn-out', 'motion'], 5, 'A soft, drawn-out wind whoosh for a gliding transition. Smooth airy sustained movement of air, gentle and premium, like floating through the shot. Longer and softer than a quick whoosh, no aggression, no metallic ring, no music.'),
  sfx('whoosh-reverse', 0.88, 'motion', ['whoosh', 'reverse', 'rewind', 'backwards', 'suck', 'motion'], 10, 'A soft reversed air whoosh, like time rewinding: a smooth backwards-sucking sweep that rises and cuts off cleanly. Restrained and premium, low-mids, no metallic ring, no music.'),
  sfx('whoosh-data-burst', 1.2, 'motion', ['whoosh', 'data', 'speed', 'fast', 'stream', 'ai-working', 'digital', 'motion'], 1, 'A fast, clean digital data whoosh: a quick soft airy swoosh carrying a rapid flurry of tiny soft ticks streaming past, like lines of data flying by at high speed, then gone. Premium and modern, smooth, about one second, ends cleanly. No static, no glitch stutter, no beeps, no bass hit, no music, no voices.'),
  sfx('dash-zip', 1, 'motion', ['dash', 'run', 'zip', 'sprint', 'fast', 'cartoon', 'skid', 'motion'], 1, 'A small cartoon character dashing past very fast: a quick zippy whoosh with a light flurry of tiny rapid footsteps, ending in a short soft skid stop on a floor, playful but clean, about one second. No voices, no music, no boing, no slide whistle.'),
  sfx('flame-snuff', 0.6, 'foley', ['flame', 'candle', 'snuff', 'blow-out', 'puff', 'vanish', 'gone', 'foley'], 1, 'A small candle flame being snuffed out: one soft, quick, breathy puff with a tiny dying flicker, close-miked, clean and quiet, about half a second. No voices, no music, no wind gust, no whoosh.'),
  sfx('impact-soft', 1, 'emphasis', ['impact', 'hit', 'emphasis', 'soft', 'thud', 'underline'], 13, 'A soft, warm low impact marking a moment. Gentle rounded thud with a short natural tail, premium and restrained, felt more than heard. Not a big cinematic boom, no harsh slam, no music.'),
  sfx('impact-deep-soft', 1.6, 'emphasis', ['impact', 'deep', 'reveal', 'payoff', 'emphasis', 'long-tail', 'boom'], 9, 'A soft, deep impact with a gentle long tail, for a meaningful reveal. A warm low thud that blooms and decays smoothly, premium and restrained, felt in the chest but never loud. Not a harsh trailer slam, no distortion, no music.'),
  sfx('stamp-hit', 0.6, 'emphasis', ['stamp', 'verdict', 'slam', 'mark', 'blocked', 'emphasis'], 7, 'A rubber stamp slamming once onto paper on a desk: a firm dry thump with a subtle paper slap, decisive and clean, close-mic, short, no echo, no music.'),
  sfx('launch-thump', 1, 'impact', ['cannon', 'launch', 'rocket', 'fire', 'mortar', 'thump', 'physics'], 1, 'A deep muffled launch thump, like a distant mortar or a rocket igniting far away: a soft round low-frequency push with a short body and a gentle tail. Warm and restrained, no sharp crack, no explosion debris, no reverb tail of a war film. Dry, clean, close to a felt mallet on a large drum.'),
  sfx('ui-click-soft', 0.48, 'snap', ['ui', 'click', 'menu', 'tick', 'select', 'snap'], 13, 'A single soft, clean UI click. Subtle muted mechanical tick, premium and understated, like a menu opening in a high-end app. Very short, dry, no reverb, no music.'),
  sfx('ui-toggle-on', 0.6, 'snap', ['ui', 'toggle', 'switch', 'on', 'click', 'enable', 'snap'], 2, 'A soft, satisfying toggle switch flipping on. Gentle rounded click with a tiny positive upward tail, premium product UI sound. Short and clean, minimal, dry, no music.'),
  sfx('trap-snap', 0.68, 'snap', ['trap', 'snap', 'shut', 'latch', 'catch', 'mechanism'], 2, 'A metallic trap snapping shut once: a fast sharp mechanical snap with a solid latch click at the end. Tight and decisive, close-mic, short, dry, not cartoonish, no music.'),
  sfx('pop-reveal', 0.48, 'emphasis', ['pop', 'reveal', 'appear', 'ui', 'result', 'emphasis'], 16, 'A gentle soft pop for revealing content on screen. Rounded warm bubble pop with a tiny subtle sparkle, premium UI reveal. Short and clean, not loud, dry, no music.'),
  sfx('chime-reward', 0.88, 'reward', ['chime', 'reward', 'positive', 'free', 'gift', 'success'], 9, 'A soft positive reward chime, two gentle warm bell notes rising, premium and understated, like unlocking a free gift in a polished app. Short, clean, no long reverb tail, no music bed.'),
  sfx('chime-magic', 1.6, 'reward', ['chime', 'magic', 'wonder', 'glockenspiel', 'hope', 'story'], 2, "A gentle magical chime — a soft warm bell and glockenspiel twinkle that gently rises and sparkles, wondrous tender and comforting like a firefly's glow appearing in the dark, delicate, no harshness, no music."),
  sfx('riser-soft', 1.36, 'tension', ['riser', 'swell', 'build', 'anticipation', 'tension', 'teaser'], 11, 'A short, gentle upward riser building light anticipation. Smooth airy swell, calm and premium, subtle, resolving softly at the top. About one second, not dramatic, not loud, no big hit, no cymbal.'),
  sfx('warm-shimmer', 2.2, 'reward', ['shimmer', 'warm', 'swell', 'heartfelt', 'embrace', 'story'], 2, 'A warm tender shimmer swell — a soft glowing rise of gentle bell and harp-like sparkle blooming warmly, heartfelt and comforting like a loving embrace, emotional and soft, no drums, no music.'),
  sfx('sparkle-soft', 0.88, 'emphasis', ['sparkle', 'twinkle', 'magic', 'shimmer', 'whimsical', 'story'], 2, 'A light delicate magical sparkle twinkle — a soft shimmering glisten of tiny bright bell-like particles, gentle airy and warm, whimsical and quick, storybook, no harshness, no music.'),
  sfx('clock-tick-soft', 3, 'texture', ['clock', 'tick', 'tock', 'countdown', 'timer', 'chess-clock', 'texture'], 2, 'A soft mechanical chess clock ticking gently: about three calm tick-tock cycles, muted, precise, quiet, close-mic, no bell, no music.'),
  sfx('page-flip', 0.6, 'foley', ['page', 'flip', 'paper', 'book', 'turn', 'foley'], 2, 'A single soft paper page turn. Light natural page flip of a storybook, gentle and clean, close-miked, short, dry, no music.'),
];

const match = (prompt: string) => matchLibrarySounds(CATALOG, prompt, { soundClass: 'sfx' });
const ids = (prompt: string) => match(prompt).map((m) => (m.entry.relPath.split('/').pop() ?? '').replace(/\.mp3$/, ''));
const WHOOSHES = ['whoosh-soft', 'whoosh-wind', 'whoosh-reverse', 'whoosh-data-burst'];

describe('placement clauses end the head clause (F1)', () => {
  it('the head word is the sound, not the placement verb', () => {
    expect(headWord('a quick whoosh when the slide changes')).toBe('whoosh');
    expect(headWord('a whoosh while the card flies in')).toBe('whoosh');
    expect(headWord('a deep impact hit when the logo lands')).toBe('hit');
    expect(headWord('a click when the button is pressed')).toBe('click');
    expect(headWord('a chime when the answer is right')).toBe('chime');
    expect(headWord('a tension riser until the reveal')).toBe('riser');
    expect(headWord('a whoosh once the scene switches')).toBe('whoosh');
    expect(headWord('When the logo lands, add a deep impact hit.')).toBe('hit');
    expect(headWord('a chime as soon as the answer is right')).toBe('chime');
  });

  it.each([
    'a quick whoosh when the slide changes',
    'a whoosh while the card flies in',
    'a whoosh once the scene switches',
  ])('"%s" → a whoosh first, never the toggle the placement verb names', (prompt) => {
    const out = ids(prompt);
    expect(WHOOSHES).toContain(out[0]);
    expect(out).not.toContain('ui-toggle-on');
  });

  it.each([
    'a deep impact hit when the logo lands',
    'an impact when the logo lands',
    'When the logo lands, add a deep impact hit.',
  ])('"%s" → the two impacts first', (prompt) => {
    expect(ids(prompt).slice(0, 2).sort()).toEqual(['impact-deep-soft', 'impact-soft']);
  });

  it('"a hit when the logo lands" → impact-soft first', () => {
    expect(ids('a hit when the logo lands')[0]).toBe('impact-soft');
  });

  it('"a click when the button is pressed" → ui-click-soft first', () => {
    expect(ids('a click when the button is pressed')[0]).toBe('ui-click-soft');
  });

  it('"a chime when the answer is right" (and "as soon as") → the two chimes', () => {
    expect(ids('a chime when the answer is right').slice(0, 2).sort()).toEqual(['chime-magic', 'chime-reward']);
    expect(ids('a chime as soon as the answer is right').slice(0, 2).sort()).toEqual(['chime-magic', 'chime-reward']);
  });

  it('"a tension riser until the reveal" → riser-soft first', () => {
    expect(ids('a tension riser until the reveal')[0]).toBe('riser-soft');
  });

  it('"as a / an …" stays a qualifier, not a placement: "a whoosh as a transition" still weighs "transition"', () => {
    const out = match('a whoosh as a transition');
    expect(out[0].entry.relPath).toBe('sfx/whoosh-soft.mp3');
    expect(out[1].coverage).toBeLessThan(1);
  });

  it('a sound the library does not have still finds nothing behind a placement clause', () => {
    expect(ids('a cuckoo clock chime when the timer ends')).toEqual([]);
    expect(ids('a dog bark when the door opens')).toEqual([]);
    expect(ids('when the logo lands')).toEqual([]);
  });
});
