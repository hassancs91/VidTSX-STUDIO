// Learn the cut knobs from the user's joins (plan T1 "the learning signal",
// B4): measure the touched joins (cut-learn-measure), fit the knobs
// (cut-learn-fit) and propose a knob when Q4 holds for it: ≥ 10 touched edges
// on its side AND the fitted value differs from the current one by more than
// 30 ms (1 dB for `margin`). The gate is on the FIT, not on the median offset
// from the style's own edges: at joins where the onset rule gives both styles
// the same lead-in the offset is 0, which dilutes the median below 30 ms while
// the fit still lands on the user's knob (B4 verifier round 1). The medians
// stay on the report — the card shows them beside the fitted values. Joins the
// user never touched teach nothing; the report says how many joins it learned
// from and lists each one. Pure.

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

  // The user's median offset from the style's own edges — reported in the
  // "unchanged" notes only; the gate is on the fitted values (header).
  const headOffset = median(headRows.map((r) => (r.leadIn as number) - (r.styleLeadIn as number)));
  const tailOffset = median(tailRows.map((r) => (r.tail as number) - (r.styleTail as number)));
  const levelOffset = median(tailRows.map((r) => (r.tailDb as number) - (r.styleTailDb as number)));

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

  // Q4 gate per knob: ≥ 10 edges on its side (above) and |fitted − current|
  // > 30 ms (> 1 dB for margin).
  if (enoughHeads && !pushChange(changes, 'head', style.head, head, heads.length, CUT_LEARN_MIN_SECONDS)) {
    notes.push(
      `Your lead-ins fit head ${sec(head)}, within 30 ms of the current ${sec(style.head)} (median offset from the style's lead-ins ${signedMs(headOffset)}): head unchanged.`,
    );
  }
  if (enoughTails) {
    const moved = [
      pushChange(changes, 'minTail', style.minTail, fitted.minTail as number, tails.length, CUT_LEARN_MIN_SECONDS),
      pushChange(changes, 'maxTail', style.maxTail, fitted.maxTail as number, tails.length, CUT_LEARN_MIN_SECONDS),
      pushChange(changes, 'margin', style.margin, fitted.margin as number, tails.length, CUT_LEARN_MIN_DB),
    ];
    if (!moved.some(Boolean)) {
      notes.push(
        `Your tails fit within 30 ms and 1 dB of the current tail knobs (median offset from the style's tails ${signedMs(tailOffset)}, ${signedDb(levelOffset)}): tail knobs unchanged.`,
      );
    }
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
): boolean {
  if (Math.abs(to - from) <= threshold + EPS) return false;
  changes.push({ knob, from, to, samples });
  return true;
}

function sec(s: number): string {
  return `${Math.round(s * 1000) / 1000} s`;
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
