// E3 fix round 2 (E-d14) — THE CORPUS: the matcher's acceptance bar. Every prompt the E3 builders and both
// verifier rounds sent to the matcher (150 distinct prompt / class / length rows: the builders' 70 —
// `E3\catalog-order-fix1.txt`; verifier round 1 — `E3-verify\c-matcher.json`, `b-noprov.json`; round 2 —
// `E3-verify\r2\a-noprov.json`, `c-probe.txt`), each with its RIGHT outcome by plain meaning, over all 51
// catalog clips of a real imported library (`sound-match-corpus.fixture.ts`, verbatim). Where a recorded result
// was wrong the row says the right one (F2: "a bell rung once" offered `dash-zip`, a cartoon dash).
//
// Expectation: 'a|b' = the FIRST result is one of these (clips that tie for a real reason); '∅' = no match
// (generate); 'a|∅' = either; '*' = anything. `not` = never offered in the top three (a clearly wrong sound).
// `music` = generate_music (a number = the asked length in seconds: shorter beds are dropped).
// Not here: `list_assets` queries (a plain word filter, not this matcher).
import { describe, expect, it } from 'vitest';
import { matchLibrarySounds } from './sound-match';
import { CORPUS_LIBRARY } from './sound-match-corpus.fixture';

interface Opts { music?: true | number; not?: string[] }
type Row = [prompt: string, expected: string, opts?: Opts];

const W = 'whoosh-soft|whoosh-wind|whoosh-reverse|whoosh-data-burst';
const IMPACT = 'impact-soft|impact-deep-soft';
const CLICK = 'ui-click-soft|ui-toggle-on';
const CHIME = 'chime-reward|chime-magic';
/** The clips whose description holds bell notes (no clip is a bell): an offer of one is fair, finding nothing too. */
const BELLISH = 'chime-reward|chime-magic|sparkle-soft|warm-shimmer|∅';
const M: Opts = { music: true };

const ROWS: Row[] = [
  // ── the builders' 70 (fix round 1's table; verifier round 1's c-matcher prompts are all in it) ──
  ['a quick whoosh when the slide changes', W],
  ['a whoosh while the card flies in', W],
  ['a deep impact hit when the logo lands', IMPACT],
  ['an impact when the logo lands', IMPACT],
  ['a hit when the logo lands', 'impact-soft|stamp-hit'],
  ['a click when the button is pressed', CLICK],
  ['a chime when the answer is right', CHIME],
  ['a tension riser until the reveal', 'riser-soft'],
  ['a whoosh once the scene switches', W, { not: ['ui-toggle-on'] }],
  ['a soft airy whoosh for a transition', 'whoosh-soft'],
  ['soft whoosh', 'whoosh-soft'],
  ['Add a soft whoosh at the first cut.', 'whoosh-soft'],
  ['a soft whoosh for a cut', 'whoosh-soft'],
  ['a fast airy whoosh with a short tail', 'whoosh-data-burst'],
  ['whoosh transition', 'whoosh-soft'],
  ['a gentle swoosh between scenes', W],
  ['a cuckoo clock chime', '∅'],
  ['a soft cuckoo clock chime, two wooden notes, playful, no music', '∅'],
  ['a soft UI click', 'ui-click-soft'],
  ['camera shutter', 'camera-shutter', { not: ['trap-snap'] }],
  ['a door knock', 'knock-solid'],
  ['a dog bark', '∅'],
  ['whoosh', W],
  ['whooshes', W],
  ['WHOOSH!!', W],
  ['a soft whoosh', 'whoosh-soft'],
  ['whoosh soft', 'whoosh-soft'],
  ['a whoosh but not soft', W], // negation drops words, never demotes — a recorded limit
  ['a whoosh without air', W],
  ['a deep impact hit', IMPACT],
  ['a deep impact hit as the logo lands', IMPACT],
  ['deep impact hit for the logo reveal', IMPACT],
  ['impact', IMPACT],
  ['riser', 'riser-soft'],
  ['risers', 'riser-soft'],
  ['a riser', 'riser-soft'],
  ['click', CLICK],
  ['clicks', CLICK],
  ['a click', CLICK],
  ['a typing sound', 'keys-typing-soft'],
  ['keyboard typing', 'keys-typing-soft'],
  ['chime', CHIME],
  ['a pop when the bubble appears', 'pop-reveal'],
  ['a ding', `${CHIME}|∅`], // a synonym the matcher does not know — finding nothing is fair
  ['applause', '∅'],
  ['soft', '*'],
  ['x', '∅'],
  ['a', '∅'],
  ['', '∅'],
  ['the', '∅'],
  ['sound effect', '∅'],
  ['When the logo lands, add a deep impact hit.', IMPACT],
  ['a chime as soon as the answer is right', CHIME],
  ['a whoosh as a transition', 'whoosh-soft'],
  ['a hit after the logo lands', 'impact-soft|stamp-hit'],
  ['a whoosh before the slide changes', W],
  ['a cuckoo clock chime when the timer ends', '∅'],
  ['a dog bark when the door opens', '∅'],
  ['a soft whoosh when we cut to the second clip', 'whoosh-soft'],
  ['a whoosh if you have one', W],
  ['warm lo-fi bed', 'lofi-warm', M],
  ['calm ambient bed under speech', 'ambient-pad', M],
  ['upbeat corporate rock with drums', '∅', M],
  ['warm lo-fi bed', '∅', { music: 120 }],
  ['lofi', 'lofi-warm', M],
  ['a calm piano bed under the voice', 'cinematic-min', { music: 60 }],
  ['a calm piano bed under the voice', 'cinematic-min|lullaby-tender', { music: 30 }],
  ['music', '∅', M],
  ['a calm ambient bed while the host talks', 'ambient-pad', M],
  ['warm lo-fi bed until the outro', 'lofi-warm', M],
  // ── verifier round 1, through the real handler (b-noprov.json) ──
  ['whooshes for the scene changes', W],
  ['a quick swoosh as the title slides out', W],
  ['transition whoosh, airy and fast', W],
  ['a riser building tension before the reveal', 'riser-soft'],
  ['mouse click for the UI button', CLICK],
  ['a cow mooing in a field', '∅'],
  ['a steam train whistle blowing twice', '∅'],
  ['calm lo-fi background bed', 'lofi-warm', M],
  ['calm lo-fi background bed', '∅', { music: 600 }],
  ['an epic orchestral choir anthem with timpani', '∅', { music: 20 }],
  // ── verifier round 2, through the real handler (r2\a-noprov.json) ──
  ['as soft as a feather', '∅'],
  ['a whoosh as soft as a feather', 'whoosh-soft'],
  ['a whoosh as loud as possible', W],
  ['a pop as the bubble appears', 'pop-reveal'],
  ['a sound like rain while it pours', '∅'],
  ['a ding if correct', `${CHIME}|∅`],
  ['a whoosh where the cut is', W],
  ['a bell rung once', BELLISH, { not: ['dash-zip'] }], // F2: `rung` matched dash-zip's `run` tag
  ['until', '∅'],
  ['when the logo lands', '∅'],
  ['when the logo lands, a deep impact hit', IMPACT],
  ['when the logo lands a deep impact hit', IMPACT], // a leading placement clause WITHOUT a comma
  ['as the title appears, a soft whoosh', 'whoosh-soft'],
  ['a whoosh as soon as the slide changes', W],
  ['a click sound whenever a button is pressed', CLICK],
  ['a whoosh because the scene changes', W],
  ['a whoosh, when the slide changes', W],
  ['a riser till the drop', 'riser-soft'],
  ['a chime unless muted', CHIME],
  ['a whoosh whilst the title flies out', W],
  ['a soft whoosh where the cut is, airy and quick', 'whoosh-soft'],
  ['once', '∅'],
  ['a whoosh once', W],
  ['a pop when it appears', 'pop-reveal'],
  ['a swoosh while switching scenes', W, { not: ['ui-toggle-on'] }],
  ['a bell rung', BELLISH, { not: ['dash-zip'] }],
  ['a bell ringing once', BELLISH],
  ['a bell ring once', BELLISH],
  ['a single bell ring', BELLISH],
  ['a bell', BELLISH.replace('|∅', '')],
  ['a bell, rung once', BELLISH, { not: ['dash-zip'] }],
  ['a doorbell when the door opens', '∅'],
  ['a ding when the answer is right', `${CHIME}|∅`],
  ['as the title appears a soft whoosh', 'whoosh-soft'],
  ['if the answer is right a chime', CHIME],
  ['a whoosh when the slide changes and a soft airy tail', W],
  ['a hit as the logo lands', 'impact-soft|stamp-hit'],
  ['a riser as tension builds', 'riser-soft'],
  ['a whoosh as it flies in', W],
  ['a cuckoo clock chime when the hour strikes', '∅'],
  ['a cow mooing while the farmer walks', '∅'],
  ['a steam train whistle when the train leaves', '∅'],
  ['a calm piano bed while the narrator talks', 'cinematic-min|lullaby-tender', { music: 30 }],
  ['a calm piano bed while the narrator talks', '∅', { music: 600 }],
  ['warm lo-fi bed while the host explains the steps', 'lofi-warm', { music: 60 }],
  ['warm lo-fi bed while the host explains the steps', 'lofi-warm', M],
  ['upbeat corporate background music until the outro', '∅', { music: 20 }],
  ['an epic orchestral choir anthem while the credits roll', '∅', { music: 20 }],
  // ── verifier round 2, the matcher probe (r2\c-probe.txt) ──
  ['a camera shutter when the photo is taken', 'camera-shutter', { not: ['trap-snap'] }],
  ['a page turn when the chapter starts', 'page-flip'],
  ['a page flip as the page turns', 'page-flip'],
  ['keyboard typing while the code appears', 'keys-typing-soft'],
  ['a clock ticking until the timer ends', 'clock-tick-soft'],
  ['a soft tick while the countdown runs', 'clock-tick-soft'], // the countdown names the clock
  ['a glitch when the screen breaks', 'glitch-zap'],
  ['a swoosh as the card flips', W, { not: ['page-flip'] }],
  ['a sparkle when the star appears', 'sparkle-soft', { not: ['zap-electric'] }], // sparkle ≠ spark
  ['a thud as the box drops', 'impact-soft|knock-solid|impact-deep-soft'],
  ['footsteps while he runs', 'dash-zip|∅'], // the only clip with footsteps (a cartoon dash)
  ['a riser while the tension builds', 'riser-soft'],
  ['a whoosh if the scene cuts', W],
  ['an impact where the title slams in', IMPACT],
  ['a pop if a bubble appears', 'pop-reveal'],
  ['a toggle click when the switch flips', 'ui-toggle-on', { not: ['page-flip'] }],
  ['a snap when the trap closes', 'trap-snap'], // the trap names the clip
  ['a shimmer as the hero smiles', 'warm-shimmer|sparkle-soft'],
  ['a bell ringing', BELLISH],
  ['a curious documentary bed while the narrator explains', 'docu-pluck', { music: 45 }],
  ['tech pulse music as the product demo plays', 'tech-pulse', { music: 30 }],
  ['a tender lullaby while the story is read', 'lullaby-tender', { music: 40 }],
];

const idOf = (relPath: string) => (relPath.split('/').pop() ?? relPath).replace(/\.mp3$/, '');
function run(prompt: string, opts: Opts = {}): string[] {
  const music = opts.music !== undefined;
  const minDurationSec = typeof opts.music === 'number' ? opts.music : undefined;
  return matchLibrarySounds(CORPUS_LIBRARY, prompt, {
    soundClass: music ? 'music' : 'sfx',
    ...(minDurationSec !== undefined ? { minDurationSec } : {}),
  }).map((m) => idOf(m.entry.relPath));
}

describe('the matcher corpus (E-d14): every prompt used so far, the right outcome by plain meaning', () => {
  it('covers the whole catalog and every recorded prompt', () => {
    expect(CORPUS_LIBRARY).toHaveLength(51);
    expect(ROWS).toHaveLength(150);
  });

  it.each(ROWS)('%j → %s', (prompt, expected, opts) => {
    const out = run(prompt, opts);
    if (expected !== '*') {
      const allowed = expected.split('|');
      expect(allowed, `got ${out.join(', ') || '∅'}`).toContain(out[0] ?? '∅');
    }
    for (const wrong of opts?.not ?? []) expect(out).not.toContain(wrong);
  });
});
