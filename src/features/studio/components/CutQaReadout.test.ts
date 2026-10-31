// The B3 card readout. Vitest runs in Node with no DOM, so the card renders to
// static markup (wording, tone, order, cap) and the row's click is exercised
// by calling the hook-free row component and firing its onClick prop.

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CutQaItem, CutQaReport } from '@shared/types/studio-cut-plan';
import type { StudioProposal, StudioTimeline } from '@shared/types/studio';
import { CutQaReadout, CutQaSpotRow } from './CutQaReadout';
import { ReviewCutsSection } from './ReviewCutsSection';
import { applyCutProposal } from '../services/apply-cut-proposal';
import { buildQaSpots } from '../services/cut-proposal';

const timeline: StudioTimeline = {
  tracks: [
    {
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [{ id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 10, sourceIn: 0 }],
    },
  ],
};

function makeProposal(qa?: CutQaReport): StudioProposal {
  return {
    id: 'p',
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: '',
    agentNote: 'Auto Cut (Tight) · 1 cut',
    items: [{ id: 'x', status: 'accepted', assetId: 'a1', sourceStart: 2, sourceEnd: 3 }],
    ...(qa ? { qa } : {}),
  };
}

function tail(sourceTime: number, overDb: number): CutQaItem {
  return { kind: 'clipped-tail', sourceTime, wordEnd: sourceTime - 0.1, overDb, assetId: 'a1' };
}

function report(items: CutQaItem[], joins = 2, atoms = 3): CutQaReport {
  return {
    hardEntries: items.filter((i) => i.kind === 'hard-entry').length,
    clippedTails: items.filter((i) => i.kind === 'clipped-tail').length,
    joinsChecked: joins,
    atomsChecked: atoms,
    items,
  };
}

function render(qa: CutQaReport, defaultExpanded = false): string {
  const proposal = makeProposal(qa);
  return renderToStaticMarkup(
    createElement(CutQaReadout, {
      qa,
      proposal,
      resultTimeline: applyCutProposal(timeline, proposal),
      onAudition: () => {},
      defaultExpanded,
    }),
  );
}

const MIXED = report([
  { kind: 'hard-entry', sourceTime: 3, overDb: 16.4, assetId: 'a1' },
  tail(5, 7.2),
  tail(8, 11.5),
]);

describe('CutQaReadout', () => {
  it('shows both checks with denominators; hard entries in the error tone', () => {
    const html = render(MIXED);
    expect(html).toContain('Hard entries 1 of 2 joins');
    expect(html).toContain('Tails on a release 2 of 3 landings');
    expect(html).toMatch(/data-cut-qa-hard="1"[^>]*text-accent-red/);
    expect(html).toContain('soft landing; listen if it sounds cut');
    expect(html).toContain('List the spots (3)');
    expect(html).not.toContain('data-cut-qa-spot');
  });

  it('zero hard entries read neutral, not red', () => {
    const html = render(report([tail(5, 7.2)]));
    expect(html).toContain('Hard entries 0 of 2 joins');
    expect(html).not.toMatch(/data-cut-qa-hard="0"[^>]*text-accent-red/);
  });

  it('nothing flagged → one quiet "QA clean" line, no list', () => {
    const html = render(report([]));
    expect(html).toContain('data-cut-qa="clean"');
    expect(html).toContain('>QA clean<');
    expect(html).not.toContain('Hard entries 0 of 2 joins<');
    expect(html).not.toContain('data-cut-qa-toggle');
  });

  it('the open list puts hard entries first, then tails loudest first', () => {
    const html = render(MIXED, true);
    const order = [...html.matchAll(/\+(\d+\.\d) dB/g)].map((m) => m[1]);
    expect(order).toEqual(['16.4', '11.5', '7.2']);
    expect(html.indexOf('data-cut-qa-spot="hard-entry"')).toBeLessThan(
      html.indexOf('data-cut-qa-spot="clipped-tail"'),
    );
  });

  it('caps the list at 20 with "show all"', () => {
    const many = report(Array.from({ length: 25 }, (_, i) => tail(4 + i * 0.1, 7 + i * 0.1)), 2, 30);
    const html = render(many, true);
    expect(html.match(/data-cut-qa-spot=/g)).toHaveLength(20);
    expect(html).toContain('Show all 25');
  });
});

describe('CutQaSpotRow', () => {
  it('a click auditions the spot at its mapped RESULT-timeline time', () => {
    const qa = report([{ kind: 'hard-entry', sourceTime: 3, overDb: 16.4, assetId: 'a1' }]);
    const proposal = makeProposal(qa);
    const [spot] = buildQaSpots(applyCutProposal(timeline, proposal), proposal, qa);
    const onAudition = vi.fn();
    const row = CutQaSpotRow({ spot, onAudition });
    (row.props as { onClick: () => void }).onClick();
    expect(onAudition).toHaveBeenCalledWith(2); // the join: source 3 plays at 2 once [2,3] is cut
  });

  it('a spot that is not on the timeline is disabled and does nothing', () => {
    const onAudition = vi.fn();
    const row = CutQaSpotRow({ spot: { item: tail(40, 9), time: null }, onAudition });
    const props = row.props as { onClick: () => void; disabled: boolean };
    expect(props.disabled).toBe(true);
    props.onClick();
    expect(onAudition).not.toHaveBeenCalled();
  });
});

describe('ReviewCutsSection + QA', () => {
  function section(proposal: StudioProposal): string {
    return renderToStaticMarkup(
      createElement(ReviewCutsSection, {
        proposal,
        timeline,
        selectedCutId: null,
        dispatch: () => {},
        onSelectItem: () => {},
        onPlayRemoved: () => {},
        onPlayJoin: () => {},
        onPlayQaSpot: () => {},
        previewResult: false,
        onTogglePreviewResult: () => {},
        onApplied: () => {},
      }),
    );
  }

  it('a proposal without qa (pre-B3) renders no readout', () => {
    const html = section(makeProposal());
    expect(html).toContain('1 proposed');
    expect(html).not.toContain('data-cut-qa');
  });

  it('a proposal with qa shows the readout under the headline', () => {
    const html = section(makeProposal(MIXED));
    expect(html.indexOf('Auto Cut (Tight)')).toBeLessThan(html.indexOf('Hard entries 1 of 2 joins'));
  });
});
