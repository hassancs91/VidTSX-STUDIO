// E3 fix round 3 (E-d15) — the corpus, extended with verifier round 3's probes: `E3-verify\r3\b-probes.txt`
// section "inflections" (every inflection of the catalog's tag / name words, as the verifier typed them),
// each with its right outcome by plain meaning. F3: a word that matches a tag only by stem ("running" →
// `run`, "shutting" → `shut`, "moving" → `move`) must never put a stranger clip (dash-zip, trap-snap,
// chess-piece-thock) ahead of the clip that holds the sound (stream-soft, power-down, wind-soft).
import {
  CHIME, CLICK, CRASH, FAIL, HIT, IMPACT, KNOCK, NO_DASH, NO_SNUFF, NO_TRAP, POP, SNAP, THUD, W, WIND, ZAP,
  describeCorpus, type CorpusRow,
} from './sound-match-corpus-rows';

const ROWS: CorpusRow[] = [
  ['whooshing', W], ['a whooshing sound', W], ['a whooshy transition', W], ['swooshing', W], ['a swooshing transition', W], ['whooshed', W],
  ['popping', POP], ['a popping sound', POP], ['bubbles popping', 'pop-reveal'], ['pops', POP], ['a popped balloon', `${POP}|∅`],
  ['clicking', CLICK], ['a clicking sound', CLICK], ['mouse clicks', CLICK], ['a clicky button', `${CLICK}|∅`], ['clicked', CLICK],
  ['ticking', 'clock-tick-soft|ui-click-soft'], ['a ticking clock', 'clock-tick-soft'], ['the clock ticks', 'clock-tick-soft'],
  ['tick tock', 'clock-tick-soft'], ['a clock ticking down', 'clock-tick-soft'],
  ['typing', 'keys-typing-soft'], ['someone typing on a keyboard', 'keys-typing-soft'], ['keys being typed', 'keys-typing-soft'],
  ['typed text appearing', 'keys-typing-soft|∅'],
  ['knocking', KNOCK], ['knocking on a door', 'knock-solid'], ['a knock at the door', 'knock-solid'], ['door knocks', 'knock-solid'],
  ['crashing', CRASH], ['a crash', CRASH], ['things crashing', CRASH], ['crashes', CRASH],
  ['breaking glass', 'break-glass-crack'], ['glass breaking', 'break-glass-crack'], ['glass shattering', 'break-glass-crack'],
  ['a shattering window', 'break-glass-crack|∅'], ['cracking glass', 'break-glass-crack'], ['cracked glass', 'break-glass-crack'],
  ['snapping', SNAP], ['a snapping trap', 'trap-snap'], ['snaps', SNAP], ['a snappy click', CLICK],
  ['chiming', CHIME], ['chimes', CHIME], ['a chiming bell', CHIME],
  ['sparkling', 'sparkle-soft'], ['sparkles', 'sparkle-soft'], ['a sparkly reveal', 'pop-reveal|sparkle-soft'],
  ['twinkling', 'sparkle-soft'], ['twinkles', 'sparkle-soft'], ['a twinkle', 'sparkle-soft'],
  ['shimmering', 'sparkle-soft|warm-shimmer'], ['a shimmery swell', 'warm-shimmer'], ['rising tension', 'riser-soft'],
  ['a swelling riser', 'riser-soft'], ['swells', 'riser-soft|warm-shimmer'], ['a building riser', 'riser-soft'], ['tension building', 'riser-soft'],
  ['hitting', HIT], ['hits', HIT], ['a hard hit', HIT], ['impacts', IMPACT], ['a heavy impact', IMPACT],
  ['thudding', THUD], ['a thud', THUD], ['thuds', THUD], ['booming', 'impact-deep-soft'], ['a boom', 'impact-deep-soft'], ['booms', 'impact-deep-soft'],
  ['humming', 'scan-hum'], ['a hum', 'scan-hum'], ['a low hum', 'scan-hum'], ['hums', 'scan-hum'],
  ['scanning', 'scan-hum'], ['a scanning sound', 'scan-hum'], ['a scanner', 'scan-hum'], ['radar scanning', 'scan-hum'],
  ['glitching', 'glitch-zap'], ['a glitchy transition', 'glitch-zap'], ['glitches', 'glitch-zap'],
  ['zapping', ZAP], ['zaps', ZAP], ['electric zaps', 'zap-electric'], ['sparks flying', 'zap-electric'],
  ['stamping', 'stamp-hit'], ['a stamp', 'stamp-hit'], ['stamped', 'stamp-hit'], ['stamps', 'stamp-hit'],
  ['flipping pages', 'page-flip'], ['page flips', 'page-flip'], ['a page flipping', 'page-flip'], ['pages turning', 'page-flip'], ['turning a page', 'page-flip'],
  ['scribbling', 'pencil-scribble'], ['pencil scribbles', 'pencil-scribble'], ['sketching', 'pencil-scribble'], ['drawing with a pencil', 'pencil-scribble'],
  ['hooting owl', 'owl-hoot'], ['an owl hooting', 'owl-hoot'], ['owls', 'owl-hoot'],
  ['a babbling brook', 'stream-soft'], ['running water', 'stream-soft', NO_DASH], ['water running', 'stream-soft', NO_DASH], // F3
  ['a flowing stream', 'stream-soft'], ['trickling water', 'stream-soft'], ['water trickling', 'stream-soft'],
  ['a stream', 'stream-soft|whoosh-data-burst'], ['streams', 'stream-soft|whoosh-data-burst'], ['water flowing', 'stream-soft'],
  ['a running stream', 'stream-soft', NO_DASH], ['running water in a stream', 'stream-soft'], // F3
  ['wind blowing', `${WIND}|∅`, NO_SNUFF], ['windy', WIND], ['a gentle breeze', 'wind-soft'], ['breezy', 'wind-soft'],
  ['wind through trees', 'wind-soft'], ['rustling leaves', 'wind-soft'],
  ['a candle being blown out', 'flame-snuff'], ['snuffing a candle', 'flame-snuff'], ['blowing out a candle', 'flame-snuff'], ['a candle snuffed', 'flame-snuff'],
  ['biting a cookie', 'crunch-bite'], ['a crunchy bite', 'crunch-bite'], ['crunching', 'crunch-bite'], ['eating a biscuit', 'crunch-bite'], ['a bite', 'crunch-bite'],
  ['party poppers', 'party-popper'], ['confetti popping', 'party-popper'], ['a celebration', 'party-popper'],
  ['a toggle switching on', 'ui-toggle-on'], ['switching on', 'ui-toggle-on'], ['a switch flip', 'ui-toggle-on'], ['flipping a switch', 'ui-toggle-on'], ['toggling', 'ui-toggle-on'],
  ['sending a message', 'ui-send'], ['message sent', 'ui-send|∅'], ['a swish', 'ui-send'],
  ['a camera taking a photo', 'camera-shutter'], ['taking a photo', 'camera-shutter'], ['taking a picture', 'camera-shutter|∅'],
  ['photo capture', 'camera-shutter'], ['capturing a screenshot', 'camera-shutter'], ['a screenshot', 'camera-shutter'],
  ['a chess piece moving', 'chess-piece-thock'], ['moving a chess piece', 'chess-piece-thock'], ['chess moves', 'chess-piece-thock'],
  ['a chess capture', 'chess-piece-capture'], ['capturing a piece', 'chess-piece-capture'],
  ['power down', 'power-down'], ['powering down', 'power-down'], ['shutting down', 'power-down', NO_TRAP], // F3
  ['a device shutting off', 'power-down'], ['turning off', 'power-down'],
  ['a rocket launching', 'launch-thump'], ['launching a rocket', 'launch-thump'], ['cannon firing', 'launch-thump'], ['cannon fire', 'launch-thump'],
  ['a cartoon dash', 'dash-zip'], ['someone running fast', 'dash-zip'], ['running footsteps', 'dash-zip'], ['dashing past', 'dash-zip'],
  ['a sprint', 'dash-zip'], ['sprinting', 'dash-zip'], ['zipping past', 'dash-zip'],
  ['a scary sting', 'sting-scare-comic'], ['a jump scare', 'sting-scare-comic'], ['a horror sting', 'sting-scare-comic'], ['a comedic sting', 'sting-scare-comic'],
  ['a reveal', 'pop-reveal|impact-deep-soft'], ['revealing', 'pop-reveal|impact-deep-soft'], ['a reveal pop', 'pop-reveal'], ['appearing', 'pop-reveal'],
  ['rewinding', 'whoosh-reverse'], ['a rewind', 'whoosh-reverse'], ['a reversed whoosh', 'whoosh-reverse'], ['reversing', 'whoosh-reverse'],
  ['gliding', 'whoosh-wind'], ['floating', 'whoosh-wind'], ['a floating whoosh', 'whoosh-wind'],
  ['data streaming', 'whoosh-data-burst'], ['a data burst', 'whoosh-data-burst'], ['bursting', 'party-popper|whoosh-data-burst'],
  ['a digital crash', 'break-crash-digital'], ['software crashing', 'break-crash-digital'], ['an error sound', 'glitch-zap|break-crash-digital'],
  ['errors', 'glitch-zap|break-crash-digital'], ['failing', FAIL], ['a fail sound', FAIL], ['a messy crash', 'crash-tumble'],
  ['things tumbling', 'crash-tumble'], ['tumbling objects', 'crash-tumble'], ['a collapse', 'crash-tumble'], ['collapsing', 'crash-tumble'],
];

describeCorpus('the matcher corpus, round 3 — inflections (b-probes)', ROWS, 194);
