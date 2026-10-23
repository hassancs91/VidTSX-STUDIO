// B7 item 5 (orchestrator decision 1): a card item whose join the card's own
// QA hears as a hard entry is built UNCHECKED, with its reason on the row.
import { describe, expect, it } from 'vitest';
import type { StudioProposalItem } from '../types/studio';
import type { CutQaItem, CutQaReport } from '../types/studio-cut-plan';
import {
  formatQaFlag,
  formatQaUncheckedLine,
  hardEntriesAtItemJoins,
  uncheckQaFlaggedItems,
} from './cut-qa-flags';

function item(id: string, sourceStart: number, sourceEnd: number, over: Partial<StudioProposalItem> = {}): StudioProposalItem {
  return { id, status: 'accepted', assetId: 'a1', sourceStart, sourceEnd, category: 'retake', ...over };
}

function report(items: CutQaItem[]): CutQaReport {
  return {
    hardEntries: items.filter((i) => i.kind === 'hard-entry').length,
    clippedTails: items.filter((i) => i.kind === 'clipped-tail').length,
    joinsChecked: 3,
    atomsChecked: 3,
    items,
  };
}

// Two cuts: the QA hears a hard entry where speech resumes after the first
// (its sourceEnd, as the snapper rounds it) and only a soft tail near the second.
const ITEMS = [item('c0', 203.5, 204.209), item('c1', 300, 301.4)];
const QA = report([
  { kind: 'hard-entry', sourceTime: 204.21, overDb: 15.9, assetId: 'a1' },
  { kind: 'clipped-tail', sourceTime: 301.4, wordEnd: 301.2, overDb: 8.1, assetId: 'a1' },
]);

describe('hardEntriesAtItemJoins', () => {
  it("finds the hard entry at an item's join (its end, ±20 ms) and nothing at the other's", () => {
    const flags = hardEntriesAtItemJoins(ITEMS, QA);
    expect(flags[0].map((q) => q.sourceTime)).toEqual([204.21]);
    expect(flags[1]).toEqual([]);
  });

  it("ignores a hard entry at another asset's join, one 30 ms off, and an item's START", () => {
    const qa = report([
      { kind: 'hard-entry', sourceTime: 204.209, overDb: 20, assetId: 'other' },
      { kind: 'hard-entry', sourceTime: 204.24, overDb: 20, assetId: 'a1' },
      { kind: 'hard-entry', sourceTime: 300, overDb: 20, assetId: 'a1' },
    ]);
    expect(hardEntriesAtItemJoins(ITEMS, qa)).toEqual([[], []]);
  });

  it('matches an unstamped QA item (plan QA before withQaAsset) by time alone', () => {
    const qa = report([{ kind: 'hard-entry', sourceTime: 204.2, overDb: 18 }]);
    expect(hardEntriesAtItemJoins(ITEMS, qa)[0]).toHaveLength(1);
  });

  it('no report, or an item without a source end → no flags', () => {
    expect(hardEntriesAtItemJoins(ITEMS, undefined)).toEqual([[], []]);
    const shot: StudioProposalItem = { id: 'x', status: 'accepted' };
    expect(hardEntriesAtItemJoins([shot], QA)).toEqual([[]]);
  });
});

describe('uncheckQaFlaggedItems', () => {
  it('builds the flagged item rejected with its loudest hard entry; the clean one is untouched', () => {
    const qa = report([
      { kind: 'hard-entry', sourceTime: 204.209, overDb: 12.0, assetId: 'a1' },
      { kind: 'hard-entry', sourceTime: 204.21, overDb: 15.9, assetId: 'a1' },
    ]);
    const out = uncheckQaFlaggedItems(ITEMS, qa);
    expect(out[0]).toMatchObject({
      id: 'c0',
      status: 'rejected',
      qaFlag: { kind: 'hard-entry', sourceTime: 204.21, overDb: 15.9 },
    });
    expect(out[1]).toBe(ITEMS[1]);
  });

  it('a fluff (already unchecked) keeps rejected and gains the reason', () => {
    const out = uncheckQaFlaggedItems([item('f', 203.5, 204.209, { status: 'rejected', category: 'fluff' })], QA);
    expect(out[0]).toMatchObject({ status: 'rejected', qaFlag: { overDb: 15.9 } });
  });

  it('no report → the same items', () => {
    expect(uncheckQaFlaggedItems(ITEMS, undefined)).toEqual(ITEMS);
  });
});

describe('the reason text', () => {
  it('the row reads the level and says how to override', () => {
    expect(formatQaFlag({ kind: 'hard-entry', sourceTime: 204.21, overDb: 15.9 })).toBe(
      'Unchecked by QA: hard entry +15.9 dB where speech resumes — play it; tick to cut anyway',
    );
  });

  it('the tool-result line names every flagged item; empty when none is flagged', () => {
    const out = uncheckQaFlaggedItems(
      [...ITEMS, item('c2', 391.59, 391.988, { status: 'rejected', category: 'fluff' })],
      report([
        { kind: 'hard-entry', sourceTime: 204.209, overDb: 15.9, assetId: 'a1' },
        { kind: 'hard-entry', sourceTime: 391.988, overDb: 22.04, assetId: 'a1' },
      ]),
    );
    expect(formatQaUncheckedLine(out)).toBe(
      '2 cuts start unchecked because the QA hears a hard entry where speech resumes after them: ' +
        '203.50–204.21 s retake (+15.9 dB), 391.59–391.99 s fluff (+22.0 dB)',
    );
    expect(formatQaUncheckedLine(ITEMS)).toBe('');
  });

  it('one flagged item reads in the singular', () => {
    const out = uncheckQaFlaggedItems(ITEMS, QA);
    expect(formatQaUncheckedLine(out)).toBe(
      '1 cut starts unchecked because the QA hears a hard entry where speech resumes after it: 203.50–204.21 s retake (+15.9 dB)',
    );
  });
});
