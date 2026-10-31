// E3 fix round 4 (E-d16 + E-d16a) — the corpus, extended with verifier round 4's probes: `g-probe.txt` (participle + noun,
// the F4 phrasings) and `f-probe.txt` (the adjective + verb-form and participle + noun sections — the verdicts are this file's,
// the probe file carries none). Outcomes by plain meaning; rows already in the corpus are not repeated. E-d16's bar
// (`describeAnswerCorpus`, the convention in `sound-match-corpus-rows.ts`): the right clip in the ANSWER's three, a
// confident first allowed. E-d16a notes (`edge: 'line'` — the confident first sits exactly at 0.50, the right clip beside
// it): "a breaking screen" (power-down), "a glitched photo" (camera-shutter), "a typed message" (ui-send). Vocabulary note
// ('∅', the right clip scores 0): "a rewound tape". Weak-match firsts beside the right clip ("a cracked screen" → power-down
// weak, break-glass-crack closest) are E-d16 notes, not asserted.
import {
  CRASH, KNOCK, ZAP, describeAnswerCorpus, type CorpusRow,
} from './sound-match-corpus-rows';

const ROWS: CorpusRow[] = [
  // ── g-probe.txt — participle + noun ──
  ['a scribbled note', 'pencil-scribble'],
  ['scribbling a note', 'pencil-scribble'],
  ['a scribbled note when the text appears', 'pencil-scribble'],
  ['a typed note', 'keys-typing-soft'],
  ['a cracked screen', 'break-glass-crack'],
  ['a breaking screen', 'break-glass-crack|break-crash-digital', { edge: 'line' }], // E-d16a note: power-down exactly 0.50 first, both break clips 0.30 beside it
  ['a glitching screen', 'glitch-zap'],
  ['a zapped screen', ZAP],
  ['a shattered screen', 'break-glass-crack'],
  ['a crashing screen', CRASH],
  ['a glitched screen', 'glitch-zap'],
  ['a crashed app on screen', 'break-crash-digital'],
  ['a scanned screen', 'scan-hum'],
  ['a flickering screen', '∅'],
  ['a ticking timer', 'clock-tick-soft'],
  ['a popped bubble', 'pop-reveal'],
  ['a knocked door', 'knock-solid'],
  ['a cracking pane of glass', 'break-glass-crack'],
  ['a typed terminal prompt', 'keys-typing-soft'],
  ['a swished message', 'ui-send'],
  ['a snapped latch', 'trap-snap'],
  ['a scribbled route on paper', 'pencil-scribble'],
  ['a sketched note', 'pencil-scribble'],
  ['a crunched cookie', 'crunch-bite'],
  ['a rewound tape', '∅'], // vocabulary note: whoosh-reverse says rewind / reverse, never "rewound" — nothing scores, the tool generates
  ['a knocking on the board', 'chess-piece-capture|chess-piece-thock|knock-solid'],
  ['a hooting forest', 'owl-hoot'],
  ['a trickling nature sound', 'stream-soft|wind-soft'],
  ['a glitched video signal', 'glitch-zap'],
  ['a corrupted screen', 'glitch-zap'],
  ['a dying device', 'power-down'],
  ['a snapping mechanism', 'trap-snap'],
  // ── f-probe.txt — adjective + verb-form, participle + noun ──
  ['a soft knocking', KNOCK],
  ['a gentle knocking', KNOCK],
  ['a loud knocking', KNOCK],
  ['a soft knocking when the door opens', 'knock-solid'],
  ['a soft breaking', 'break-crash-digital|break-glass-crack'],
  ['a slow ticking', 'clock-tick-soft'],
  ['a loud crashing', CRASH],
  ['a quiet humming', 'scan-hum'],
  ['a soft typing', 'keys-typing-soft'],
  ['a soft knock', KNOCK],
  ['a knocking', KNOCK],
  ['a soft knocking at the door', 'knock-solid'],
  ['a note being scribbled', 'pencil-scribble'],
  ['a scribbled signature', 'pencil-scribble'],
  ['a pencil note', 'pencil-scribble'],
  ['a sketched route', 'pencil-scribble'],
  ['a scribbled line', 'pencil-scribble'],
  ['a glitched photo', 'glitch-zap', { edge: 'line' }], // E-d16a note: camera-shutter exactly 0.50 first (photo), glitch-zap 0.30 beside it
  ['a popped message', 'pop-reveal|ui-send'],
  ['a typed message', 'keys-typing-soft', { edge: 'line' }], // E-d16a note: ui-send exactly 0.50 first (message), keys-typing-soft 0.30 beside it
  ['a launched message', 'ui-send|launch-thump'],
  ['a knocked board', 'chess-piece-capture|chess-piece-thock|knock-solid'],
  ['a snapped photo', 'camera-shutter'],
  ['a crashed device', 'power-down|break-crash-digital'],
  ['a shattered phone screen', 'break-glass-crack'],
  ['a captured photo', 'camera-shutter'],
  ['a flipped book', 'page-flip'],
  ['a typed prompt', 'keys-typing-soft'],
  ['a crunched snack', 'crunch-bite'],
  ['a swiped card', 'whoosh-soft'],
  ['a clicked menu', 'ui-click-soft'],
  ['a toggled switch', 'ui-toggle-on'],
  ['a hooted night', 'owl-hoot'],
  ['a stamped mark', 'stamp-hit'],
  ['a dashed sprint', 'dash-zip'],
];

describeAnswerCorpus('the corpus, verifier round 4 (fix round 4, E-d16): participle + noun, adjective + verb-form', ROWS, 67);
