// Cut QA — the reference pipeline's two plan checks (claude-youtube-editor
// tools/analyze_cut.py; plan T1, part B3) over the waveform cache's
// RmsEnvelope. Pure: no I/O. Thresholds and windows are analyze_cut's exactly.
//
//  - Hard entries (`entry_check`): a planned segment that begins at a REAL
//    cut join — the first segment, or a raw skip > 0.75 s after the previous
//    segment's end — while the audio just before it is still hot: the 50 ms
//    window starting 60 ms before the cut-in reads > 15 dB over the floor (a
//    breath intake sits ~+12 dB, real speech +20 and up). Compressed
//    intra-keep pauses (≤ 0.75 s) are not checked: the audio before them is
//    legitimately the same phrase.
//  - Clipped tails (analyze_cut `main`): for every speech-run ATOM (not every
//    join), the tail the planner gives it (`tailFor`; gap = next atom start −
//    this end, none for the last atom) lands where the 50 ms window still
//    reads > 6 dB over the floor — the word's release is audible where we land.
//
// Studio reads 20 ms buckets, not samples (rms-envelope.ts): a window that
// straddles a loud bucket edge can over-read it, so expect a few threshold-
// edge disagreements with analyze_cut on real material.

import type { CutPlanStyle, CutQaItem, CutQaReport } from '../types/studio-cut-plan';
import { tailFor } from './cut-planner';
import type { PlanSpan } from './cut-planner';
import type { RmsEnvelope } from './rms-envelope';

/** A segment start more than this after the previous segment's end is a real cut join. */
export const QA_REAL_JOIN_GAP_S = 0.75;
/** The hard-entry window starts this long before the cut-in… */
export const QA_ENTRY_LOOKBACK_S = 0.06;
/** …and is this long. */
export const QA_ENTRY_WINDOW_S = 0.05;
/** A cut-in whose window reads more than this over the floor is a hard entry. */
export const QA_HARD_ENTRY_DB = 15;
/** The window read where a tail lands (cutlib's default `rms_db` window). */
export const QA_TAIL_WINDOW_S = 0.05;
/** A landing that reads more than this over the floor is a clipped tail. */
export const QA_CLIPPED_TAIL_DB = 6;

export interface CutQaInput {
  /** Planned segments in source order (after any merge) — hard entries walk these. */
  segments: readonly PlanSpan[];
  /** Speech-run atoms (`splitAtoms`) — clipped tails walk these. */
  atoms: readonly PlanSpan[];
  /** The knobs the plan was made with (after capability compensation). */
  style: CutPlanStyle;
  envelope: RmsEnvelope;
}

/** analyze_cut `entry_check`: hot cut-ins at real joins. */
export function findHardEntries(
  segments: readonly PlanSpan[],
  envelope: RmsEnvelope,
  floorDb: number = envelope.floorDb(),
): { items: CutQaItem[]; joinsChecked: number } {
  const items: CutQaItem[] = [];
  let joinsChecked = 0;
  let prevEnd: number | null = null;
  for (const seg of segments) {
    if (prevEnd === null || seg.start - prevEnd > QA_REAL_JOIN_GAP_S) {
      joinsChecked++;
      const over =
        envelope.rmsDb(Math.max(seg.start - QA_ENTRY_LOOKBACK_S, 0), QA_ENTRY_WINDOW_S) - floorDb;
      if (over > QA_HARD_ENTRY_DB) {
        items.push({ kind: 'hard-entry', sourceTime: seg.start, overDb: round1(over) });
      }
    }
    prevEnd = seg.end;
  }
  return { items, joinsChecked };
}

/** analyze_cut's clipped-tail loop: per atom, the level where its tail lands. */
export function findClippedTails(
  atoms: readonly PlanSpan[],
  style: CutPlanStyle,
  envelope: RmsEnvelope,
  floorDb: number = envelope.floorDb(),
): { items: CutQaItem[]; atomsChecked: number } {
  const items: CutQaItem[] = [];
  for (let i = 0; i < atoms.length; i++) {
    const e = atoms[i].end;
    const gap = i + 1 < atoms.length ? atoms[i + 1].start - e : null;
    const { tail } = tailFor(envelope, e, gap, style);
    const over = envelope.rmsDb(e + tail, QA_TAIL_WINDOW_S) - floorDb;
    if (over > QA_CLIPPED_TAIL_DB) {
      items.push({
        kind: 'clipped-tail',
        sourceTime: round3(e + tail),
        wordEnd: e,
        overDb: round1(over),
      });
    }
  }
  return { items, atomsChecked: atoms.length };
}

/** Both checks on one clip's plan. */
export function runCutQa(input: CutQaInput): CutQaReport {
  const floor = input.envelope.floorDb();
  const entries = findHardEntries(input.segments, input.envelope, floor);
  const tails = findClippedTails(input.atoms, input.style, input.envelope, floor);
  return {
    hardEntries: entries.items.length,
    clippedTails: tails.items.length,
    joinsChecked: entries.joinsChecked,
    atomsChecked: tails.atomsChecked,
    items: [...entries.items, ...tails.items],
  };
}

/** Several clips' reports as one (a card that spans clips); item order is kept per kind. */
export function mergeCutQa(reports: readonly CutQaReport[]): CutQaReport {
  const items = reports.flatMap((r) => r.items);
  return {
    hardEntries: reports.reduce((n, r) => n + r.hardEntries, 0),
    clippedTails: reports.reduce((n, r) => n + r.clippedTails, 0),
    joinsChecked: reports.reduce((n, r) => n + r.joinsChecked, 0),
    atomsChecked: reports.reduce((n, r) => n + r.atomsChecked, 0),
    items: [
      ...items.filter((x) => x.kind === 'hard-entry'),
      ...items.filter((x) => x.kind === 'clipped-tail'),
    ],
  };
}

/** The card's QA line: "Hard entries 0 · clipped tails 12", or "QA clean". */
export function formatCutQaLine(report: CutQaReport): string {
  if (report.hardEntries === 0 && report.clippedTails === 0) return 'QA clean';
  return `Hard entries ${report.hardEntries} · clipped tails ${report.clippedTails}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
