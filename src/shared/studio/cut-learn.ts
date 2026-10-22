// Learn the cut knobs from the user's joins (plan T1 "the learning signal",
// B4): measure the touched joins (cut-learn-measure), gate on Q4 (≥ 10 joins,
// the user's median offset from the style's own edges > 30 ms or > 1 dB), fit
// the knobs (cut-learn-fit) and propose only those that move by more than the
// same thresholds. Joins the user never touched teach nothing; the report
// says how many joins it learned from and lists each one. Pure.

import type { CutPlanStyle } from '../types/studio-cut-plan';
import {
  CUT_LEARN_MIN_DB,
  CUT_LEARN_MIN_JOINS,
  CUT_LEARN_MIN_SECONDS,
  type CutLearnChange,
  type CutLearnJoinInput,
  type CutLearnKnob,
  type CutLearnMedians,
  type CutLearnReport,
} from '../types/studio-cut-learn';
import { measureCutJoins, type CutLearnAsset } from './cut-learn-measure';
import { fitHead, fitTails } from './cut-learn-fit';

/** Float slack on the strict "more than 30 ms / 1 dB" comparisons. */
const EPS = 1e-9;

export function learnCutKnobs(
  inputs: CutLearnJoinInput[],
  assets: ReadonlyMap<string, CutLearnAsset>,
  style: CutPlanStyle,
): CutLearnReport {
  const { rows, tails, heads } = measureCutJoins(inputs, assets, style);
  const measured = rows.filter((r) => r.tail !== undefined || r.leadIn !== undefined);
  const tailRows = rows.filter((r) => r.tail !== undefined);
  const headRows = rows.filter((r) => r.leadIn !== undefined);

  const medians: CutLearnMedians = {};
  setMedian(medians, 'leadIn', headRows.map((r) => r.leadIn as number), 3);
  setMedian(medians, 'styleLeadIn', headRows.map((r) => r.styleLeadIn as number), 3);
  setMedian(medians, 'tail', tailRows.map((r) => r.tail as number), 3);
  setMedian(medians, 'styleTail', tailRows.map((r) => r.styleTail as number), 3);
  setMedian(medians, 'tailDb', tailRows.map((r) => r.tailDb as number), 1);
  setMedian(medians, 'styleTailDb', tailRows.map((r) => r.styleTailDb as number), 1);

  const notes: string[] = [];
  const fitted: CutLearnReport['fitted'] = {};
  const changes: CutLearnChange[] = [];
  const enoughHeads = heads.length >= CUT_LEARN_MIN_JOINS;
  const enoughTails = tails.length >= CUT_LEARN_MIN_JOINS;

  if (measured.length < CUT_LEARN_MIN_JOINS) {
    notes.push(
      `Learned from ${measured.length} join${measured.length === 1 ? '' : 's'} — at least ${CUT_LEARN_MIN_JOINS} touched joins are needed before the cut knobs change.`,
    );
  }
  if (!enoughHeads && headRows.length > 0 && measured.length >= CUT_LEARN_MIN_JOINS) {
    notes.push(`${heads.length} lead-ins touched — at least ${CUT_LEARN_MIN_JOINS} needed to learn the lead-in.`);
  }
  if (!enoughTails && tailRows.length > 0 && measured.length >= CUT_LEARN_MIN_JOINS) {
    notes.push(`${tails.length} tails touched — at least ${CUT_LEARN_MIN_JOINS} needed to learn the tail.`);
  }

  // Q4 gate per side: the user's median offset from the style's own edges.
  const headOffset = median(headRows.map((r) => (r.leadIn as number) - (r.styleLeadIn as number)));
  const tailOffset = median(tailRows.map((r) => (r.tail as number) - (r.styleTail as number)));
  const levelOffset = median(tailRows.map((r) => (r.tailDb as number) - (r.styleTailDb as number)));
  const headDiffers = headOffset !== undefined && Math.abs(headOffset) > CUT_LEARN_MIN_SECONDS + EPS;
  const tailDiffers =
    (tailOffset !== undefined && Math.abs(tailOffset) > CUT_LEARN_MIN_SECONDS + EPS) ||
    (levelOffset !== undefined && Math.abs(levelOffset) > CUT_LEARN_MIN_DB + EPS);

  let head = style.head;
  let margin = style.margin;
  if (enoughHeads) {
    head = fitHead(heads, style, margin);
    fitted.head = head;
  }
  if (enoughTails) {
    const t = fitTails(tails, style, head);
    fitted.minTail = t.minTail;
    fitted.maxTail = t.maxTail;
    fitted.margin = t.margin;
    margin = t.margin;
    // The onset walk reads the margin too: refit the lead-in with the new one.
    if (enoughHeads && margin !== style.margin) fitted.head = head = fitHead(heads, style, margin);
  }

  if (enoughHeads && headDiffers) {
    pushChange(changes, 'head', style.head, head, heads.length, CUT_LEARN_MIN_SECONDS);
  } else if (enoughHeads) {
    notes.push(`Your lead-ins sit within 30 ms of the style's (median ${signedMs(headOffset)}): head unchanged.`);
  }
  if (enoughTails && tailDiffers) {
    pushChange(changes, 'minTail', style.minTail, fitted.minTail as number, tails.length, CUT_LEARN_MIN_SECONDS);
    pushChange(changes, 'maxTail', style.maxTail, fitted.maxTail as number, tails.length, CUT_LEARN_MIN_SECONDS);
    pushChange(changes, 'margin', style.margin, fitted.margin as number, tails.length, CUT_LEARN_MIN_DB);
  } else if (enoughTails) {
    notes.push(
      `Your tails sit within 30 ms and 1 dB of the style's (median ${signedMs(tailOffset)}, ${signedDb(levelOffset)}): tail knobs unchanged.`,
    );
  }

  const soft = tailRows.filter((r) => r.styleSoft).length;
  if (soft > 0) {
    notes.push(
      `${soft} of ${tailRows.length} tails land soft under this style (gap ≥ ${style.softGap} s): margin and maxTail do not reach them — softMargin and softMaxTail do.`,
    );
  }
  const skipped = rows.filter((r) => r.skipped).length;
  if (skipped > 0) notes.push(`${skipped} touched join${skipped === 1 ? '' : 's'} had an edge that could not be measured.`);

  return {
    joins: measured.length,
    headEdges: heads.length,
    tailEdges: tails.length,
    minJoins: CUT_LEARN_MIN_JOINS,
    medians,
    fitted,
    changes,
    notes,
    joinsList: rows,
  };
}

function pushChange(
  changes: CutLearnChange[],
  knob: CutLearnKnob,
  from: number,
  to: number,
  samples: number,
  threshold: number,
): void {
  if (Math.abs(to - from) > threshold + EPS) changes.push({ knob, from, to, samples });
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function setMedian(
  into: CutLearnMedians,
  key: keyof CutLearnMedians,
  values: number[],
  decimals: number,
): void {
  const m = median(values);
  if (m === undefined) return;
  const f = Math.pow(10, decimals);
  into[key] = Math.round(m * f) / f;
}

function signedMs(s: number | undefined): string {
  const v = Math.round((s ?? 0) * 1000);
  return `${v >= 0 ? '+' : ''}${v} ms`;
}

function signedDb(db: number | undefined): string {
  const v = Math.round((db ?? 0) * 10) / 10;
  return `${v >= 0 ? '+' : ''}${v} dB`;
}
