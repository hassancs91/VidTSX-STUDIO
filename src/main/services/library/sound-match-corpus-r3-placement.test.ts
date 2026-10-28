// E3 fix round 3 (E-d15) — the corpus, extended with verifier round 3's probes: `b-probes.txt` section
// "placement" and `c-probes2.txt` section "placementAdverbs" — the F1 class: multi-word openers ("every
// time", "the moment", "the instant"), the adverbs that lead into a placement or a preposition ("right
// when", "exactly when", "shortly after", "only when"), trailing "here / now / again / too", leading
// placement clauses with and without a comma, and the wrappers around an ask. Outcomes by plain meaning.
import { CHIME, CLICK, HIT, IMPACT, KNOCK, POP, W, describeCorpus, type CorpusRow } from './sound-match-corpus-rows';

const ROWS: CorpusRow[] = [
  // ── b-probes "placement" ──
  ['a click when the user taps the button', CLICK], ['when the user taps the button, a click', CLICK], ['when the user taps the button a click', CLICK],
  ['a pop as each bullet appears', POP], ['as each bullet appears, a pop', POP], ['as each bullet appears a pop', POP],
  ['a whoosh whenever the camera moves', W], ['whenever the camera moves, a whoosh', W], ['whenever the camera moves a whoosh', W],
  ['a typing sound while the code is written', 'keys-typing-soft'], ['while the code is written, a typing sound', 'keys-typing-soft'],
  ['while the code is written a typing sound', 'keys-typing-soft'],
  ['a riser until the logo appears', 'riser-soft'], ['until the logo appears, a riser', 'riser-soft'], ['until the logo appears a riser', 'riser-soft'],
  ['a chime once the code compiles', CHIME], ['once the code compiles, a chime', CHIME], ['once the code compiles a chime', CHIME],
  ['a glitch if the screen freezes', 'glitch-zap'], ['if the screen freezes, a glitch', 'glitch-zap'], ['if the screen freezes a glitch', 'glitch-zap'],
  ['a whoosh unless the scene is static', W], ['a crash because the app fails', 'break-crash-digital|crash-tumble'],
  ['because the app fails, a crash', 'break-crash-digital|crash-tumble'],
  ['a glass crack where the screen breaks', 'break-glass-crack'], ['where the screen breaks, a glass crack', 'break-glass-crack'],
  ['where the screen breaks a glass crack', 'break-glass-crack'],
  ['a pop wherever a label appears', POP], ['a riser till the reveal', 'riser-soft'], ['till the reveal a riser', 'riser-soft'],
  ['a whoosh whilst the title moves', W], ['whilst the title moves a whoosh', W],
  ['a chime as soon as the quiz is solved', CHIME], ['as soon as the quiz is solved a chime', CHIME], ['as soon as the quiz is solved, a chime', CHIME],
  ['when the photo is taken a camera shutter', 'camera-shutter'], ['when the photo is taken, a camera shutter', 'camera-shutter'],
  ['when the door opens a knock', 'knock-solid'], ['a knock before the door opens', 'knock-solid'], ['a knock when someone visits', KNOCK],
  ['when the trap closes a snap', 'trap-snap'], ['when the card flips a whoosh', W, { not: ['page-flip'] }], ['when a card flips a whoosh', W, { not: ['page-flip'] }],
  ['when the logo lands deep impact hit', IMPACT], ['when the logo lands impact', IMPACT], ['as the bubble appears pop', 'pop-reveal'],
  ['a whoosh right when the slide changes', W], ['a soft whoosh right at the first cut', 'whoosh-soft'], ['Add a soft whoosh right at the first cut.', 'whoosh-soft'],
  ['a pop right as the bubble appears', 'pop-reveal'], ['a hit right when the logo lands', HIT], ['a click right when the button is pressed', CLICK],
  ['a chime right after the answer', CHIME], ['a whoosh exactly when the slide changes', W], ['a whoosh just when the slide changes', W],
  ['a whoosh every time the slide changes', W], ['a pop every time a bullet appears', POP], ['a click each time the button is pressed', CLICK],
  ['a whoosh the moment the slide changes', W], ['a pop the moment the bubble appears', 'pop-reveal'], ['every time the slide changes, a whoosh', W],
  ['a whoosh any time the scene changes', W], ['a whoosh after each slide', W], ['a whoosh on every slide change', W], ['a whoosh at each scene change', W],
  ['a whoosh at the start', W], ['a whoosh at the end of the intro', W], ['a soft whoosh at 0:03', 'whoosh-soft'], ['a soft whoosh at 3 seconds', 'whoosh-soft'],
  ['a whoosh here', W], ['a whoosh there', W], ['a whoosh now', W], ['a whoosh again', W], ['another whoosh', W], ['one more whoosh', W],
  ['a second whoosh', W], ['the same whoosh again', W], ['a whoosh too', W], ['a whoosh as well', W], ['also a whoosh', W], ['a whoosh please', W],
  ['could you add a whoosh', W], ['I want a whoosh', W], ['put a soft whoosh on the cut', 'whoosh-soft'], ['a soft whoosh over the cut', 'whoosh-soft'],
  ['a soft whoosh under the title', 'whoosh-soft'], ['a whoosh for the transition into the demo', 'whoosh-soft'], ['a whoosh into the next scene', W],
  ['a whoosh between the two clips', W], ['a soft whoosh at the first cut, nothing loud', 'whoosh-soft'],
  ['a soft whoosh at the first cut and a pop at the second', 'whoosh-soft'],
  // ── c-probes2 "placementAdverbs" ──
  ['a whoosh right as the slide changes', W], ['a whoosh right after the slide changes', W], ['a whoosh right before the slide changes', W],
  ['a whoosh right at the cut', W], ['a hit right as the logo lands', HIT], ['a pop right when it appears', 'pop-reveal'],
  ['a whoosh exactly at the cut', W], ['a pop exactly when the bubble appears', 'pop-reveal'], ['a whoosh precisely when the slide changes', W],
  ['a whoosh only when the slide changes', W], ['a whoosh even when the slide changes', W], ['a whoosh immediately after the cut', W],
  ['a whoosh shortly after the cut', W], ['a whoosh soon after the cut', W], ['a whoosh just after the cut', W], ['a whoosh just as the slide changes', W],
  ['a whoosh each time the slide changes', W], ['a whoosh any time the slide changes', W], ['a whoosh the instant the slide changes', W],
  ['a whoosh the second the slide changes', W], ['each time a bullet appears, a pop', POP], ['a pop each time a bullet appears', POP],
  ['a click every time the button is pressed', CLICK], ['a chime every time the answer is right', CHIME], ['a riser every time the tension builds', 'riser-soft'],
  ['a hit the moment the logo lands', HIT], ['an impact the moment the logo lands', IMPACT], ['a whoosh at the moment the slide changes', W],
  ['a whoosh at the exact moment the slide changes', W], ['a whoosh at the cut', W], ['a whoosh on the cut', W], ['a whoosh on each cut', W],
  ['a whoosh on every cut', W], ['a whoosh at every cut', W], ['a whoosh for every cut', W], ['a pop for each bullet', POP], ['a pop on each bullet', POP],
  ['a whoosh later', W],
];

describeCorpus('the matcher corpus, round 3 — placement openers, adverbs, trailing words, wrappers', ROWS, 129);
