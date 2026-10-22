// The cut-QA readout on a cut card (B3): analyze_cut's two checks on the plan
// that made the proposal. Hard entries are an error class (red when > 0);
// tails on a release are informational (a soft landing — listen if it sounds
// cut). Both always carry their denominator; "QA clean" only when both are 0.
// A toggle lists the spots — hard entries first, then tails loudest first,
// QA_VISIBLE_SPOTS before "show all" — and every spot auditions: one click
// plays ~2 s around it with the cuts applied. The wording lives in
// `@shared/studio/cut-qa` so the agent's replies and the card agree.

import { useMemo, useState } from 'react';
import { formatCutQaLine, formatHardEntries, formatReleaseTails } from '@shared/studio/cut-qa';
import type { CutQaReport } from '@shared/types/studio-cut-plan';
import type { StudioProposal, StudioTimeline } from '../types';
import {
  QA_VISIBLE_SPOTS,
  buildQaSpots,
  formatCutTc,
  type QaSpot,
} from '../services/cut-proposal';

const HARD_TOOLTIP =
  'the cut-in starts on sound more than 15 dB over the room tone — listen for a hard entry';
const TAIL_TOOLTIP =
  'the landing is still more than 6 dB over the room tone — soft landing; listen if it sounds cut';

interface Props {
  qa: CutQaReport;
  proposal: StudioProposal;
  /** The timeline with the proposal's accepted cuts applied — where spots play. */
  resultTimeline: StudioTimeline;
  /** Audition around a RESULT-timeline time (the shell turns the result preview on). */
  onAudition: (timelineTime: number) => void;
  /** Open the spot list on first render. */
  defaultExpanded?: boolean;
}

export function CutQaReadout({
  qa,
  proposal,
  resultTimeline,
  onAudition,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const spots = useMemo(
    () => buildQaSpots(resultTimeline, proposal, qa),
    [resultTimeline, proposal, qa],
  );

  if (qa.hardEntries === 0 && qa.clippedTails === 0) {
    return (
      <div
        data-cut-qa="clean"
        className="text-[10px] text-text-dim"
        title={`${formatHardEntries(qa)} · ${formatReleaseTails(qa)}`}
      >
        {formatCutQaLine(qa)}
      </div>
    );
  }

  const visible = showAll ? spots : spots.slice(0, QA_VISIBLE_SPOTS);
  return (
    <div data-cut-qa="report" className="flex flex-col gap-[2px]">
      <div
        data-cut-qa-hard={qa.hardEntries}
        className={`text-[10px] tabular-nums ${
          qa.hardEntries > 0 ? 'text-accent-red' : 'text-text-secondary'
        }`}
        title={HARD_TOOLTIP}
      >
        {formatHardEntries(qa)}
      </div>
      <div
        data-cut-qa-tails={qa.clippedTails}
        className="text-[10px] text-text-secondary tabular-nums"
        title={TAIL_TOOLTIP}
      >
        {formatReleaseTails(qa)}
      </div>
      {spots.length > 0 && (
        <button
          type="button"
          data-cut-qa-toggle
          className="self-start text-[10px] text-accent-blue hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide the spots' : `List the spots (${spots.length})`}
        </button>
      )}
      {expanded && (
        <div
          className="flex flex-col rounded-[6px] overflow-hidden"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {visible.map((spot, i) => (
            <CutQaSpotRow key={i} spot={spot} onAudition={onAudition} />
          ))}
          {spots.length > visible.length && (
            <button
              type="button"
              data-cut-qa-show-all
              className="px-2 py-[4px] text-left text-[10px] text-accent-blue hover:underline"
              onClick={() => setShowAll(true)}
            >
              Show all {spots.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** One listed spot; the whole row is the audition button. Hook-free on purpose. */
export function CutQaSpotRow({
  spot,
  onAudition,
}: {
  spot: QaSpot;
  onAudition: (timelineTime: number) => void;
}) {
  const { item, time } = spot;
  const hard = item.kind === 'hard-entry';
  const where =
    !hard && item.wordEnd !== undefined
      ? `word ends ${formatCutTc(item.wordEnd)}, lands ${formatCutTc(item.sourceTime)}`
      : `cut-in at ${formatCutTc(item.sourceTime)}`;
  return (
    <button
      type="button"
      data-cut-qa-spot={item.kind}
      disabled={time === null}
      className="flex items-center gap-2 px-2 py-[4px] text-left hover:bg-app-hover disabled:opacity-50 disabled:cursor-default"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
      title={
        time === null
          ? 'This spot is not on the timeline'
          : `${where} (source) — play ~2 s around it with the cuts applied`
      }
      onClick={() => {
        if (time !== null) onAudition(time);
      }}
    >
      <span className="text-[10px] text-accent-blue">▶</span>
      <span
        className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full ${
          hard ? 'bg-accent-red/15 text-accent-red' : 'bg-app-active text-text-secondary'
        }`}
      >
        {hard ? 'hard entry' : 'tail'}
      </span>
      <span className="text-[10px] text-text-primary tabular-nums">
        {formatCutTc(item.sourceTime)}
      </span>
      <span className="ml-auto text-[10px] text-text-dim tabular-nums">
        +{item.overDb.toFixed(1)} dB
      </span>
    </button>
  );
}
