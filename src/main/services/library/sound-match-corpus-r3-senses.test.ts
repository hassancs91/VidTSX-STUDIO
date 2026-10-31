// E3 fix round 3 (E-d15) — the corpus, extended with verifier round 3's probes: `b-probes.txt` section
// "collisions", `c-probes2.txt` sections "running" / "shutting" / "moving" / "senses" (the F3 cases), and
// `c-probes3.txt` (synonym inflections, comparatives, quantifiers, participle order, wrappers). Outcomes by
// plain meaning; '*' where the meaning is open (polysemy — "a shocking reveal"; a sound the library has no
// clip for — "a zipper", "waves crashing"; a tag that is the only trace — "stories", "going").
import {
  CHIME, CLICK, NO_DASH, NO_SNUFF, NO_TRAP, POP, SNAP, W, WIND, describeCorpus, type CorpusRow,
} from './sound-match-corpus-rows';

const ROWS: CorpusRow[] = [
  // ── b-probes "collisions" ──
  ['a bit of static', 'glitch-zap'], ['a little bit of static', 'glitch-zap'], ['a bit of a whoosh', W], ['a tiny bit of wind', WIND],
  ['a shocking reveal', '*'], ['a shocking hit', '*'], ['a building collapse', 'crash-tumble|riser-soft'], ['a building explosion', '∅'],
  ['a type of whoosh', W], ['a different type of whoosh', W], ['a hopping bunny', '∅'], ['a hop', '∅'],
  ['a scary moment', 'sting-scare-comic'], ['a fire crackling', '*'], ['a crackling fire', '*'], ['firing a gun', '*'], ['a gun firing', '*'],
  ['a taking off whoosh', W], ['a car taking off', '*'], ['moving air', 'wind-soft'], ['a whoosh of moving air', W], // F3
  ['a story book page', 'page-flip'], ['stories', '*'], ['a coding sound', 'keys-typing-soft'], ['coded message', 'ui-send|keys-typing-soft'],
  ['a probing beep', '∅'], ['a closing door', 'knock-solid'], ['a door closing', 'knock-solid'], ['a door closes', 'knock-solid'],
  ['a box closing', '∅'], ['a lid closing', '∅'],
  ['a single tick', 'ui-click-soft|clock-tick-soft'], ['a single pop', POP], ['singles', '*'],
  ['a marked moment', 'stamp-hit|impact-soft'], ['a marking pen', '*'], ['marks on paper', 'stamp-hit|pencil-scribble'],
  ['a turning wheel', '∅'], ['a turnstile', '∅'], ['a capture card', '*'], ['a stamped letter', 'stamp-hit|∅'], ['stamping feet', 'stamp-hit|∅'],
  ['a breaking news sting', 'sting-scare-comic|∅'], ['breaking news', '*'], ['a breakdown', '*'], ['a dying battery', 'power-down|∅'],
  ['a dies roll', '*'], ['dice rolling', '∅'],
  ['a swinging door', 'knock-solid|∅'], ['a winding clock', 'clock-tick-soft'], ['a wind-up toy', '*'], ['winding up', '*'],
  ['a running joke sting', 'sting-scare-comic|∅'],
  ['a run', 'dash-zip|∅'], ['runs', 'dash-zip|∅'], ['a running man', 'dash-zip|∅'], ['a man running', 'dash-zip|∅'], ['a runner', '∅'], // recall (fix 3): runner ≠ run (no -er), no clip scores
  ['running', 'dash-zip|∅'], ['a running engine', '∅'], ['a running fan', '∅'],
  ['a scanning laser', 'scan-hum|∅'], ['a hummingbird', '∅'], ['a human voice', '∅'], ['a timer beep', 'clock-tick-soft|∅'],
  ['timers', 'clock-tick-soft'], ['a ticket machine', '∅'],
  ['a floating island ambience', '*'], ['a gliding plane', 'whoosh-wind|∅'], ['a sweeping broom', '*'], ['a swept floor', '∅'], ['sweeping strings', '*'],
  ['a bubbly pop', 'pop-reveal'], ['a puffy cloud', '*'], ['puffing', 'flame-snuff|∅'], ['a gone moment', '*'], ['going', '*'],
  ['an eating sound', 'crunch-bite'], ['eaten', '∅'], // recall (fix 3): eaten ≠ eat (no -en), no clip scores
  ['a sliding door', 'knock-solid|∅'], ['a slide whistle', '∅'], ['sliding', '*'], ['a light switch', 'ui-toggle-on'], ['lighting', '*'],
  ['a lightning strike', '*'],
  ['a magical moment', '*'], ['magic', 'chime-magic|sparkle-soft'], ['a positive ding', `${CHIME}|∅`], ['positively', '*'],
  ['a hopeful chime', CHIME], ['hopes', '*'],
  // ── c-probes2 "running" (F3: `running` → dash-zip's `run` tag) ──
  ['the sound of running water', 'stream-soft', NO_DASH], ['gently running water', 'stream-soft'], ['softly running water', 'stream-soft'],
  ['cool running water', 'stream-soft'], ['running water from a tap', 'stream-soft'], ['a tap running', '∅', NO_DASH], // recall (fix 3): stream-soft carries neither word; dash-zip is the one near miss (never a match)
  ['water running from a tap', 'stream-soft|∅', NO_DASH], ['a running brook', 'stream-soft', NO_DASH], ['a brook running over stones', 'stream-soft', NO_DASH],
  ['a stream running through a forest', 'stream-soft|∅', NO_DASH], ['running creek', '∅', NO_DASH], // recall (fix 3): stream-soft carries neither word; dash-zip the one near miss
  ['a gentle stream of running water', 'stream-soft'], ['water running over rocks', 'stream-soft|∅', NO_DASH], ['calm running water', 'stream-soft'],
  ['running water ambience', 'stream-soft|∅', NO_DASH], ['running water, soft and calm', 'stream-soft'],
  // ── c-probes2 "shutting" (F3: `shutting` → trap-snap's `shut` tag) ──
  ['a laptop shutting down', 'power-down'], ['a computer shutting down', 'power-down|break-crash-digital'], ['a device shutting down', 'power-down'],
  ['the app shutting down', 'power-down|break-crash-digital'], ['a phone shutting down', 'power-down|∅'], ['the screen shutting off', 'power-down'],
  ['a computer shutting off', 'power-down|∅'], ['shutting off', 'power-down', NO_TRAP], ['a shutting down sound', 'power-down', NO_TRAP],
  ['a machine shutting down', 'power-down|∅'], ['a system shutting down', 'power-down|∅'], ['power shutting off', 'power-down'],
  ['a laptop powering off', 'power-down'],
  // ── c-probes2 "moving" (F3: `moving` → chess-piece-thock's `move` tag) ──
  ['air moving', 'wind-soft'], ['the sound of moving air', 'wind-soft'], ['a soft moving air sound', 'wind-soft'],
  ['moving air for a transition', 'whoosh-soft|wind-soft'], ['gently moving air', 'wind-soft'], ['fast moving air', `${W}|wind-soft`],
  ['quickly moving air', `wind-soft|${W}`], ['air moving past', `${W}|wind-soft`], ['a rush of moving air', '*'],
  // ── c-probes2 "senses" ──
  ['a door slamming', 'knock-solid|stamp-hit'], ['a slamming door', 'knock-solid|stamp-hit'], ['a car skidding', 'dash-zip|∅'],
  ['a rocket taking off', 'launch-thump|∅'], ['a plane taking off', '*'], ['taking off', '*'],
  ['a camera shutter firing', 'camera-shutter'], ['a camera firing', 'camera-shutter'], ['a whoosh going down', `${W}|power-down`],
  ['a pitch going down', '*'], ['slowing down', '*'], ['winding down', '*'], ['a key turning in a lock', '*'],
  ['fingers snapping', `${SNAP}|∅`], ['a finger snap', `${SNAP}|∅`], ['a zipper', '*'], ['zipping a jacket', '*'], ['a speeding car', '*'],
  ['waves crashing', '*'], ['a heart thumping', 'launch-thump|∅'], ['a shocking moment', '*'], ['a stinging slap', '*'],
  ['a vacuum sucking', 'whoosh-reverse|∅'],
  ['a catching sound', 'trap-snap'], ['a blocking sound', 'stamp-hit|∅'], ['a warming chime', CHIME],
  ['a capturing sound', 'camera-shutter|chess-piece-capture'], ['a firing sound', 'launch-thump|camera-shutter'],
  ['a moving whoosh', W], ['a running whoosh', `${W}|dash-zip`], ['a running sound', 'dash-zip|∅'], // F3
  ['a shutting sound', '*'], ['a taking sound', '*'], ['a closing click', CLICK], ['a closing sound', '*'],
  ['a lid shutting', 'trap-snap|∅'], ['a box shutting', 'trap-snap|∅'], ['a trap shutting', 'trap-snap'],
  ['a door shutting', 'knock-solid|trap-snap'], ['shutting the door', 'knock-solid|trap-snap'], ['a gate closing', '*'], ['a case closing', '*'],
  // ── c-probes3 "synonymInflections" (F3c: swoosh / woosh = whoosh on the stem too) ──
  ['a swooshing sound', W], ['swooshed', W], ['a swooshy transition', W], ['wooshing', W], ['a wooshing sound', W], ['woooosh', '∅'], // recall (fix 3): an elongated spelling no clip carries
  ['swishing', 'ui-send'], ['a swishing sound', 'ui-send'],
  // ── c-probes3 "comparatives" ──
  ['a softer whoosh', W], ['a whoosh but softer', W], ['a deeper impact', 'impact-deep-soft'], ['a louder pop', POP], ['a quicker whoosh', W],
  ['a longer riser', 'riser-soft'], ['a shorter whoosh', W], ['a whoosh, but softer', W],
  // ── c-probes3 "quantifiers" ──
  ['some static', 'glitch-zap'], ['a burst of static', 'glitch-zap'], ['a kind of whoosh', W], ['a sort of whoosh', W],
  ['pieces of glass breaking', 'break-glass-crack'], ['a piece of glass breaking', 'break-glass-crack'],
  // ── c-probes3 "participleOrder" ──
  ['the wind blowing', `${WIND}|∅`, NO_SNUFF], ['a wind blowing softly', `${WIND}|∅`, NO_SNUFF], ['a clock ticking', 'clock-tick-soft'],
  ['a door knocking', 'knock-solid'], ['a crowd cheering', '∅'],
  // ── c-probes3 "wrappers" ──
  ['can you add a whoosh', W], ['I need a whoosh', W], ['maybe a whoosh', W], ['probably a whoosh', W], ['something like a whoosh', W],
  ['a whoosh would be nice', W],
];

describeCorpus('the matcher corpus, round 3 — collisions, the F3 senses, synonyms, comparatives, quantifiers, wrappers', ROWS, 204);
