// Learn the cut knobs, step 1 (plan T1 "the learning signal", B4): measure
// every join the user touched. Pure — the words and the waveform envelope come
// in, nothing is read or written here.
//
// At a touched TAIL edge: tail = edge − the last word before it ends, and the
// level there over the clip's floor (the snapper's 50 ms window). At a touched
// HEAD edge: lead-in = the first word after it starts − edge. Beside each, what
// the resolved style itself would place at that join with the same words
// (`tailFor`, the planner's lead-in rule) — the card's comparison and the
// "differs from the style" gate.

import type { CutPlanStyle } from '../types/studio-cut-plan';
import type { CutLearnJoin, CutLearnJoinInput } from '../types/studio-cut-learn';
import { tailFor, type PlanWord } from './cut-planner';
import type { RmsEnvelope } from './rms-envelope';

/** A user tail longer than this after its word is not a landing (an edge in a long silence). */
export const CUT_LEARN_MAX_TAIL = 1.5;
/** A user lead-in longer than this before its word is not a lead-in. */
export const CUT_LEARN_MAX_LEAD_IN = 1.0;

/** One clip's material: its words (source seconds) and its waveform envelope. */
export interface CutLearnAsset {
  words: PlanWord[];
  envelope: RmsEnvelope;
}

/** A measured tail edge, as the knob fit reads it. */
export interface CutLearnTailSample {
  envelope: RmsEnvelope;
  wordEnd: number;
  /** Next kept word start − wordEnd (the planner's gap); null when nothing follows. */
  gap: number | null;
  /** The user's tail, seconds. */
  user: number;
}

/** A measured head edge, as the knob fit reads it. */
export interface CutLearnHeadSample {
  envelope: RmsEnvelope;
  wordStart: number;
  /** The user's lead-in, seconds. */
  user: number;
}

export interface CutLearnMeasurement {
  rows: CutLearnJoin[];
  tails: CutLearnTailSample[];
  heads: CutLearnHeadSample[];
}

/** The lead-in the planner keeps before a word that follows a join. */
export function styleLeadIn(envelope: RmsEnvelope, wordStart: number, style: CutPlanStyle): number {
  if (!style.maxHead) return style.head;
  return Math.max(
    style.head,
    envelope.snapHead(
      wordStart,
      style.head,
      style.maxHead,
      style.margin,
      style.fricZcr,
      style.fricMargin ?? 5.0,
    ),
  );
}

export function measureCutJoins(
  inputs: CutLearnJoinInput[],
  assets: ReadonlyMap<string, CutLearnAsset>,
  style: CutPlanStyle,
): CutLearnMeasurement {
  const rows: CutLearnJoin[] = [];
  const tails: CutLearnTailSample[] = [];
  const heads: CutLearnHeadSample[] = [];
  const sorted = new Map<string, PlanWord[]>();

  for (const input of inputs) {
    const wantTail = input.tailTouched && input.tailEdge !== undefined;
    const wantHead = input.headTouched && input.headEdge !== undefined;
    if (!wantTail && !wantHead) continue;
    const row: CutLearnJoin = {
      assetId: input.assetId,
      source: input.source,
      ...(input.ref !== undefined ? { ref: input.ref } : {}),
      ...(input.tailEdge !== undefined ? { tailEdge: round3(input.tailEdge) } : {}),
      ...(input.headEdge !== undefined ? { headEdge: round3(input.headEdge) } : {}),
    };
    rows.push(row);
    const asset = assets.get(input.assetId);
    if (!asset || asset.words.length === 0) {
      row.skipped = 'no words or waveform for this clip';
      continue;
    }
    let words = sorted.get(input.assetId);
    if (!words) {
      words = [...asset.words].sort((a, b) => a.start - b.start);
      sorted.set(input.assetId, words);
    }
    const { envelope } = asset;
    const floor = envelope.floorDb();
    const skips: string[] = [];
    // The first kept word after the join: past the head edge when there is
    // one, else the first word that starts after the tail edge.
    const next =
      input.headEdge !== undefined
        ? words.find((w) => w.end > (input.headEdge as number))
        : words.find((w) => w.start >= (input.tailEdge as number));
    if (next) row.nextWord = next.text;

    if (wantTail) {
      const edge = input.tailEdge as number;
      const last = lastBefore(words, edge);
      if (!last) skips.push('no word before the tail edge');
      else {
        row.lastWord = last.text;
        const tail = edge - last.end;
        if (tail > CUT_LEARN_MAX_TAIL) {
          skips.push(`tail edge ${tail.toFixed(2)} s after "${last.text}" — not a landing`);
        } else {
          const gap = next && next.start > last.end ? next.start - last.end : null;
          const planned = tailFor(envelope, last.end, gap, style);
          row.tail = round3(tail);
          row.tailDb = round1(envelope.rmsDb(edge) - floor);
          row.styleTail = round3(planned.tail);
          row.styleTailDb = round1(envelope.rmsDb(last.end + planned.tail) - floor);
          row.styleSoft = planned.soft;
          tails.push({ envelope, wordEnd: last.end, gap, user: tail });
        }
      }
    }

    if (wantHead) {
      const edge = input.headEdge as number;
      if (!next) skips.push('no word after the head edge');
      else {
        const leadIn = next.start - edge;
        if (leadIn > CUT_LEARN_MAX_LEAD_IN) {
          skips.push(`head edge ${leadIn.toFixed(2)} s before "${next.text}" — not a lead-in`);
        } else {
          row.leadIn = round3(leadIn);
          row.styleLeadIn = round3(styleLeadIn(envelope, next.start, style));
          heads.push({ envelope, wordStart: next.start, user: leadIn });
        }
      }
    }
    if (skips.length > 0) row.skipped = skips.join('; ');
  }
  return { rows, tails, heads };
}

/** The last word that starts before `t` (a word the edge cuts into counts: negative tail). */
function lastBefore(words: PlanWord[], t: number): PlanWord | undefined {
  let found: PlanWord | undefined;
  for (const w of words) {
    if (w.start < t) found = w;
    else break;
  }
  return found;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
