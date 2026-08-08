// Cut-planning core, ported from the reference pipeline's tools/cutlib.py
// (claude-youtube-editor): RMS noise floor, speech-run atoms, snap-to-audio
// tails, pause compression. Pure logic — no I/O, no LLM — so it is fully
// unit-testable; cut-plan-runner.ts does the file work around it.
//
// Unit discipline: seconds everywhere (cutlib mixed ms words with s spans; we
// do not). Levels are dBFS from the waveform cache's RMS buckets — computed in
// TypeScript because Remotion's stripped ffmpeg has no volumedetect filter.

import type { SttModelFeatures } from '../../../shared/presets/stt-models';
import type {
  CutPlanPause,
  CutPlanSegment,
  CutPlanStyle,
  StudioCutPlan,
  CutPlanStyleName,
} from '../../../shared/types/studio-cut-plan';
import { RMS_SILENCE_DB } from '../../../shared/types/studio-waveform';

export interface PlanWord {
  text: string;
  start: number;
  end: number;
}

export interface PlanSpan {
  start: number;
  end: number;
}

/** Reference values that matched the hand-made reference cut (clean-cut skill). */
export const TIGHT_STYLE: CutPlanStyle = {
  internalGap: 0.4,
  head: 0.11,
  minTail: 0.14,
  maxTail: 0.4,
  margin: 5.0,
  softGap: 1.2,
  softMaxTail: 0.6,
  softMargin: 3.0,
};

export const NATURAL_STYLE: CutPlanStyle = {
  ...TIGHT_STYLE,
  head: 0.19,
  minTail: 0.26,
  maxTail: 0.45,
};

export const CUT_PLAN_STYLES: Record<CutPlanStyleName, CutPlanStyle> = {
  tight: TIGHT_STYLE,
  natural: NATURAL_STYLE,
};

/**
 * Capability compensation (never refusal): with only approximate word timing
 * (character-distribution, error typically ±0.1–0.3 s) the pads widen so a
 * late word start doesn't get its attack clipped and an early word end still
 * reaches the RMS snap. Measured timing uses the style as-is.
 */
export function styleForFeatures(
  base: CutPlanStyle,
  features: SttModelFeatures | undefined,
): CutPlanStyle {
  if (features?.wordTimestamps) return base;
  return {
    ...base,
    head: base.head + 0.08,
    minTail: base.minTail + 0.06,
    maxTail: base.maxTail + 0.2,
    softMaxTail: base.softMaxTail + 0.2,
  };
}

/**
 * RMS envelope over the waveform cache's per-bucket dB values — the port of
 * cutlib's AudioProbe, reading pre-bucketed levels instead of raw WAV samples.
 */
export class RmsEnvelope {
  private floor: number | null = null;

  constructor(
    private readonly buckets: number[],
    private readonly bucketsPerSecond: number,
  ) {}

  /** Audio length covered by the envelope, seconds. */
  duration(): number {
    return this.buckets.length / this.bucketsPerSecond;
  }

  /** Mean power over [t, t+win), in dB. Out-of-range ⇒ silence (decayed). */
  rmsDb(t: number, win = 0.05): number {
    const a = Math.max(0, Math.floor(t * this.bucketsPerSecond));
    const b = Math.min(this.buckets.length, Math.floor((t + win) * this.bucketsPerSecond));
    if (b <= a) return RMS_SILENCE_DB;
    let power = 0;
    for (let i = a; i < b; i++) power += Math.pow(10, this.buckets[i] / 10);
    return 10 * Math.log10(power / (b - a) + 1e-12);
  }

  /** Noise floor = 10th percentile of bucket levels (cutlib's floor_db). */
  floorDb(): number {
    if (this.floor === null) {
      if (this.buckets.length === 0) return RMS_SILENCE_DB;
      const sorted = [...this.buckets].sort((x, y) => x - y);
      this.floor = sorted[Math.floor(sorted.length / 10)];
    }
    return this.floor;
  }

  /**
   * Seconds to keep after wordEnd so the word's release fully decays to the
   * noise floor. Small for clean words, larger for long-release endings.
   */
  snapTail(wordEnd: number, minTail: number, maxTail: number, margin = 5.0): number {
    const floor = this.floorDb();
    for (let o = minTail; o <= maxTail; o += 0.02) {
      if (this.rmsDb(wordEnd + o) <= floor + margin) return Math.round(o * 1000) / 1000;
    }
    return maxTail;
  }
}

/** Speech-run atoms: keeps split at pauses ≥ internalGap. */
export function splitAtoms(
  keeps: PlanSpan[],
  words: PlanWord[],
  internalGap: number,
): PlanSpan[] {
  const atoms: PlanSpan[] = [];
  for (const k of keeps) {
    const kw = words.filter((w) => k.start - 0.02 <= w.start && w.end <= k.end + 0.02);
    if (kw.length === 0) {
      atoms.push({ start: k.start, end: k.end });
      continue;
    }
    let runStart = kw[0].start;
    for (let i = 0; i + 1 < kw.length; i++) {
      if (kw[i + 1].start - kw[i].end >= internalGap) {
        atoms.push({ start: runStart, end: kw[i].end });
        runStart = kw[i + 1].start;
      }
    }
    atoms.push({ start: runStart, end: kw[kw.length - 1].end });
  }
  return atoms;
}

/**
 * Tail seconds after wordEnd. A large following gap (section end / removed
 * retake) gets a SOFT landing (more room, closer decay to floor); a small
 * mid-flow pause gets a punchy tail.
 */
export function tailFor(
  envelope: RmsEnvelope,
  wordEnd: number,
  gap: number | null,
  style: CutPlanStyle,
): { tail: number; soft: boolean } {
  const soft = gap === null || gap >= style.softGap;
  let tail = soft
    ? envelope.snapTail(wordEnd, style.minTail, style.softMaxTail, style.softMargin)
    : envelope.snapTail(wordEnd, style.minTail, style.maxTail, style.margin);
  if (gap !== null) {
    // Never cross into the next atom's lead-in.
    tail = Math.min(tail, Math.max(gap - style.head - 0.06, style.minTail * 0.5));
  }
  return { tail, soft };
}

/**
 * Render ranges (source seconds): speech-run atoms with snapped tails and
 * compressed pauses. Section ends land soft, mid-flow pauses land punchy.
 *
 * `cuts` (optional) are spans the editor explicitly removed. Pass them
 * whenever they exist: snapTail walks forward until the audio decays, so when
 * the material right after an atom is cut SPEECH rather than silence it walks
 * straight through it and the cut words ride into the render (the reference
 * pipeline measured 0.70 s of a cut phrase surviving this way). The gap clamp
 * in tailFor does not catch it — it only stops the tail reaching the next
 * KEPT atom, and a cut span sits in between.
 */
export function planClip(
  keeps: PlanSpan[],
  words: PlanWord[],
  style: CutPlanStyle,
  envelope: RmsEnvelope,
  cuts?: PlanSpan[],
): CutPlanSegment[] {
  const atoms = splitAtoms(keeps, words, style.internalGap);
  const spans = [...(cuts ?? [])].sort((a, b) => a.start - b.start);
  const segments: CutPlanSegment[] = [];

  for (let i = 0; i < atoms.length; i++) {
    const { start: s, end: e } = atoms[i];
    const gap = i + 1 < atoms.length ? atoms[i + 1].start - e : null;
    const { tail, soft } = tailFor(envelope, e, gap, style);
    // The very first atom gets a slightly roomier open (nothing precedes it).
    const openHead = i > 0 ? style.head : Math.min(0.25, style.head * 2);
    let segStart = Math.max(s - openHead, 0);
    let segEnd = e + tail;
    for (const cut of spans) {
      if (e <= cut.start && cut.start < segEnd) segEnd = cut.start; // cut starts inside our tail
      if (segStart < cut.end && cut.end <= s) segStart = cut.end; // cut ends inside our lead-in
    }
    segments.push({
      start: round3(segStart),
      end: round3(Math.max(segEnd, e)),
      speechStart: round3(s),
      speechEnd: round3(e),
      soft,
    });
  }
  return segments;
}

/** Pauses ≥ threshold that sit INSIDE kept speech (dead air while talking). */
export function internalPauses(
  keeps: PlanSpan[],
  words: PlanWord[],
  threshold: number,
): CutPlanPause[] {
  const out: CutPlanPause[] = [];
  for (const k of keeps) {
    const kw = words.filter((w) => k.start - 0.02 <= w.start && w.end <= k.end + 0.02);
    for (let i = 0; i + 1 < kw.length; i++) {
      const gap = kw[i + 1].start - kw[i].end;
      if (gap >= threshold) {
        out.push({
          at: round3(kw[i].end),
          gap: Math.round(gap * 100) / 100,
          before: kw[i].text,
          after: kw[i + 1].text,
        });
      }
    }
  }
  return out;
}

export interface PlanCutsRequest {
  assetId: string;
  createdAt: string;
  styleName: CutPlanStyleName;
  /** Source duration in seconds. */
  duration: number;
  words: PlanWord[];
  envelope: RmsEnvelope;
  /** Defaults to one keep covering the whole source. */
  keeps?: PlanSpan[];
  cuts?: PlanSpan[];
  sttModelId?: string;
  /** Feature snapshot recorded at transcription time. */
  features?: SttModelFeatures;
}

/** Full mechanical pass: atoms → snapped segments → stats + honest QA notes. */
export function planCuts(req: PlanCutsRequest): StudioCutPlan {
  const style = styleForFeatures(CUT_PLAN_STYLES[req.styleName], req.features);
  const keeps = req.keeps ?? [{ start: 0, end: req.duration }];
  const words = [...req.words].sort((a, b) => a.start - b.start);

  const segments = planClip(keeps, words, style, req.envelope, req.cuts);
  const pauses = internalPauses(keeps, words, style.internalGap);
  const keptDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  const qaNotes: string[] = [];
  if (!req.features?.verbatimDisfluencies) {
    qaNotes.push(
      'Transcript is not verbatim — this engine tidies fillers ("um"/"uh") away, so ' +
        'filler cutting will find less than a verbatim engine (e.g. AssemblyAI) would.',
    );
  }
  if (!req.features?.wordTimestamps) {
    qaNotes.push(
      'Word timings are approximate (derived from segment bounds) — head/tail pads were ' +
        'widened to compensate, so edges land softer than with measured timestamps.',
    );
  }

  return {
    version: 1,
    assetId: req.assetId,
    createdAt: req.createdAt,
    styleName: req.styleName,
    style,
    transcript: { sttModelId: req.sttModelId, features: req.features },
    segments,
    internalPauses: pauses,
    stats: {
      sourceDuration: round3(req.duration),
      keptDuration: round3(keptDuration),
      removedDuration: round3(Math.max(0, req.duration - keptDuration)),
      atomCount: segments.length,
      wordCount: words.length,
      internalPauseCount: pauses.length,
      noiseFloorDb: req.envelope.floorDb(),
    },
    qaNotes,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
