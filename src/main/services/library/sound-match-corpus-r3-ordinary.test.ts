// E3 fix round 3 (E-d15) — the corpus, extended with verifier round 3's probes: `b-probes.txt` sections
// "ordinary" (plain asks for each catalog sound) and "music" (generate_music, with the asked lengths).
// Outcomes by plain meaning; the regression guard for the ordinary phrasings a user would type.
import {
  CHIME, CLICK, CRASH, HIT, IMPACT, KNOCK, M, POP, THUD, W, WIND, ZAP, describeCorpus, type CorpusRow,
} from './sound-match-corpus-rows';

const ROWS: CorpusRow[] = [
  // ── b-probes "ordinary" ──
  ['Add a whoosh at the first cut.', W], ['Add a soft whoosh at the second cut.', 'whoosh-soft'], ['Add a whoosh sound effect at the cut.', W],
  ['a subtle whoosh', W], ['a gentle whoosh', W], ['a quick whoosh', W], ['a fast whoosh', W], ['a short whoosh', W], ['a long whoosh', W], ['a slow whoosh', W],
  ['a soft transition sound', 'whoosh-soft'], ['a transition sound', 'whoosh-soft'], ['a transition', 'whoosh-soft'], ['a swipe sound', 'whoosh-soft'], ['a swipe', 'whoosh-soft'],
  ['an airy swoosh', W], ['a whoosh with some air', W], ['a whooshing transition between scenes', 'whoosh-soft'], ['a woosh', W], ['woosh', W],
  ['a soft impact', IMPACT], ['a deep boom', 'impact-deep-soft'], ['a low thud', THUD], ['a punchy hit', HIT], ['an impact for the reveal', 'impact-deep-soft|impact-soft'],
  ['a dramatic hit', HIT], ['a big reveal', 'pop-reveal|impact-deep-soft'],
  ['a soft riser', 'riser-soft'], ['a tension riser', 'riser-soft'], ['a riser into the reveal', 'riser-soft'], ['a build-up', 'riser-soft'], ['a buildup', 'riser-soft|∅'],
  ['a soft click', CLICK], ['a button click', CLICK], ['a UI click', CLICK], ['a menu click', 'ui-click-soft'], ['a toggle sound', 'ui-toggle-on'], ['a send sound', 'ui-send'],
  ['a success chime', 'chime-reward'], ['a reward chime', 'chime-reward'], ['a magic chime', 'chime-magic'], ['a positive chime', 'chime-reward'], ['a notification chime', CHIME],
  ['a pop', POP], ['a soft pop', POP], ['a bubble pop', 'pop-reveal'], ['a party popper', 'party-popper'], ['confetti', 'party-popper'],
  ['a typing sound effect', 'keys-typing-soft'], ['keyboard clicks', 'keys-typing-soft'], ['a clock tick', 'clock-tick-soft'], ['a countdown', 'clock-tick-soft'], ['a timer', 'clock-tick-soft'],
  ['a page turn', 'page-flip'], ['a book page', 'page-flip'], ['a pencil sketch', 'pencil-scribble'],
  ['a glitch', 'glitch-zap'], ['a digital glitch', 'glitch-zap'], ['static', 'glitch-zap'], ['an error', 'glitch-zap|break-crash-digital'],
  ['glass break', 'break-glass-crack'], ['a break', 'break-crash-digital|break-glass-crack'], ['a power down', 'power-down'], ['a shutdown sound', 'power-down'],
  ['an owl', 'owl-hoot'], ['a brook', 'stream-soft'], ['water', 'stream-soft'], ['wind', WIND], ['a breeze', 'wind-soft'], ['a forest at night', 'owl-hoot|wind-soft'],
  ['a scan', 'scan-hum'], ['a rubber stamp', 'stamp-hit'], ['a verdict stamp', 'stamp-hit'], ['a scare sting', 'sting-scare-comic'], ['a sting', 'sting-scare-comic'],
  ['a zap', ZAP], ['an electric spark', 'zap-electric'], ['a spark', 'zap-electric'], ['a sparkle', 'sparkle-soft'], ['magic sparkle', 'sparkle-soft'],
  ['a shimmer', 'sparkle-soft|warm-shimmer'], ['a cookie bite', 'crunch-bite'], ['a crunch', 'crunch-bite'], ['a candle snuff', 'flame-snuff'],
  ['a camera click', 'camera-shutter'], ['a shutter', 'camera-shutter'], ['a chess move', 'chess-piece-thock'], ['a chess piece', 'chess-piece-capture|chess-piece-thock'],
  ['a launch', 'launch-thump'], ['a rocket', 'launch-thump'], ['a thump', 'launch-thump'], ['a dash', 'dash-zip'], ['a zip', 'dash-zip'], ['a skid', 'dash-zip'],
  ['a cartoon run', 'dash-zip'], ['a knock', KNOCK], ['a door', 'knock-solid'], ['a trap', 'trap-snap'],
  // ── b-probes "music" ──
  ['a lofi beat', 'lofi-warm', M], ['lo-fi beats', 'lofi-warm', M], ['cozy lofi', 'lofi-warm', M], ['a chill lofi bed', 'lofi-warm', M], ['lofi music', 'lofi-warm', { music: 30 }],
  ['ambient pads', 'ambient-pad', M], ['calm ambient music', 'ambient-pad', M], ['a piano underscore', 'cinematic-min', M], ['cinematic piano', 'cinematic-min', M],
  ['a pulsing tech bed', 'tech-pulse', M], ['techy pulse', 'tech-pulse', M], ['a documentary bed', 'docu-pluck', M], ['documentary music', 'docu-pluck', M],
  ['an explainer bed', 'docu-pluck', M], ['pizzicato plucks', 'docu-pluck', M], ['plucking strings', 'docu-pluck', M],
  ['a lullaby', 'lullaby-tender', M], ['lullabies', 'lullaby-tender', M], ['a music box lullaby', 'lullaby-tender', M],
  ['a calm bed', 'ambient-pad|cinematic-min', { music: 30 }], ['background music', '*', { music: 30 }], ['a background bed while the host talks', '*', { music: 30 }],
  ['while the host talks, a calm bed', 'ambient-pad|cinematic-min', { music: 30 }], ['while the host talks a calm bed', 'ambient-pad|cinematic-min', { music: 30 }],
  ['calm music while she explains', 'ambient-pad|cinematic-min', { music: 30 }], ['a warm bed under the voice', 'lofi-warm|ambient-pad|∅', { music: 60 }],
  ['a reflective piano bed', 'cinematic-min', { music: 45 }], ['a curious explainer bed', 'docu-pluck', { music: 45 }], ['a premium tech bed', 'tech-pulse', { music: 60 }],
  ['a tender bed', 'lullaby-tender', { music: 40 }], ['an upbeat pop song', '∅', { music: 30 }], ['a rock anthem', '∅', { music: 30 }], ['a jazzy bed', '∅', { music: 30 }],
  ['a calm bed', '∅', { music: 600 }],
];

describeCorpus('the matcher corpus, round 3 — ordinary asks and music (b-probes)', ROWS, 132);
