// Takes view: a readable, take-segmented rendering of a word-level transcript
// for the editing agent — ported from the reference pipeline's
// tools/format_transcript.py (claude-youtube-editor). Segments break on speech
// gaps > 0.8 s; filler words are marked inline with their exact timestamps so
// they can be cut individually. The #NN segment numbers are the handles the
// agent's notes refer to.
//
// Unit discipline: seconds everywhere (the reference read ms words; we don't).

export interface TakesWord {
  text: string;
  start: number;
  end: number;
}

/** Speech gap that starts a new take segment, seconds. */
export const TAKE_GAP_SECONDS = 0.8;

/**
 * The only hard-coded filler vocabulary (reference FILLERS set). Matched
 * case-insensitively after stripping trailing punctuation — the marker keeps
 * the original token so "<<uh, 256.28-256.31>>" reads naturally in context.
 */
const FILLERS = new Set(['um', 'uh', 'erm', 'hmm', 'mm', 'mhm', 'uhm']);

function isFiller(token: string): boolean {
  return FILLERS.has(token.toLowerCase().replace(/[.,?!]+$/, ''));
}

function fmtTime(seconds: number): string {
  return seconds.toFixed(2);
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface TakeSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

/** Split words into take segments on gaps > TAKE_GAP_SECONDS. */
export function splitTakes(words: TakesWord[]): TakeSegment[] {
  if (words.length === 0) return [];
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const segments: TakeSegment[] = [];
  let current: TakesWord[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start - sorted[i - 1].end > TAKE_GAP_SECONDS) {
      segments.push(buildSegment(current, segments.length + 1));
      current = [];
    }
    current.push(sorted[i]);
  }
  segments.push(buildSegment(current, segments.length + 1));
  return segments;
}

function buildSegment(words: TakesWord[], index: number): TakeSegment {
  const text = words
    .map((w) => (isFiller(w.text) ? `<<${w.text} ${fmtTime(w.start)}-${fmtTime(w.end)}>>` : w.text))
    .join(' ');
  return { index, start: words[0].start, end: words[words.length - 1].end, text };
}

/**
 * Render the full takes view for one asset's transcript. `label` heads the
 * output ("# clip <label> — N words, ends MM:SS"); pause lines sit between
 * segments so retake gaps and dead air are visible at a glance.
 */
export function formatTakesView(label: string, words: TakesWord[]): string {
  if (words.length === 0) return `# ${label} — no words`;
  const segments = splitTakes(words);
  const lines: string[] = [
    `# ${label} — ${words.length} words, ends ${clock(segments[segments.length - 1].end)}`,
  ];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i > 0) {
      const gap = seg.start - segments[i - 1].end;
      lines.push(`     -- pause ${gap.toFixed(1)}s --`);
    }
    lines.push(
      `#${String(seg.index).padStart(2, '0')} [${fmtTime(seg.start)} - ${fmtTime(seg.end)}] (${clock(seg.start)}) ${seg.text}`,
    );
  }
  return lines.join('\n');
}
