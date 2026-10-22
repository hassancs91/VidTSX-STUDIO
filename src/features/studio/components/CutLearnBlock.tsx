import { useState } from 'react';
import type { CutLearnJoin, CutLearnReport } from '@shared/types/studio-cut-learn';

interface Props {
  /** The card lines main wrote (counts, medians vs the style, fitted values, notes). */
  lines: string[];
  /** The measurement behind them — the per-join list. Absent on older cards. */
  report?: CutLearnReport;
  /** Asset id → file name, for the per-join rows (falls back to a short id). */
  assetNames?: ReadonlyMap<string, string>;
}

function sec(n: number | undefined): string {
  return n === undefined ? '—' : `${n.toFixed(2)} s`;
}

function db(n: number | undefined): string {
  return n === undefined ? '' : ` · ${n.toFixed(1)} dB`;
}

function where(join: CutLearnJoin, names: ReadonlyMap<string, string> | undefined): string {
  const name = names?.get(join.assetId) ?? join.assetId.slice(0, 8);
  const at = join.tailEdge ?? join.headEdge;
  return at === undefined ? name : `${name} @ ${at.toFixed(2)} s`;
}

/** You / the style, for one side of a join; empty when the side was not measured. */
function side(you: number | undefined, youDb: number | undefined, style: number | undefined, styleDb: number | undefined): string {
  if (you === undefined) return '';
  return `${sec(you)}${db(youDb)} / ${sec(style)}${db(styleDb)}`;
}

/** The cut-knob half of the learn card (B4): what learn-from-video measured at
 *  the joins the user trimmed — main's lines as given, then the joins
 *  themselves (collapsed): the tail and lead-in the user kept beside what the
 *  project's style would place there. Nothing here computes a number. */
export function CutLearnBlock({ lines, report, assetNames }: Props) {
  const [showJoins, setShowJoins] = useState(false);
  const joins = report?.joinsList ?? [];

  return (
    <div className="space-y-1 rounded bg-app-surface p-1.5" data-preset-update-cut>
      {lines.map((line, i) => (
        <div key={i} className="text-[10px] text-text-dim leading-snug" data-preset-update-cut-line>
          {line}
        </div>
      ))}
      {joins.length > 0 && (
        <button
          type="button"
          onClick={() => setShowJoins((v) => !v)}
          className="text-[10px] text-text-muted hover:text-text-secondary"
          data-preset-update-toggle-joins
        >
          {showJoins ? 'Hide' : 'Show'} the {joins.length} join{joins.length === 1 ? '' : 's'} it measured
        </button>
      )}
      {showJoins && joins.length > 0 && (
        // Stacked rows, not a table: the Assistant column is ~200 px wide, and a
        // three-column table pushed the numbers off-screen (seen live in B4 step 5).
        <div className="max-h-[200px] overflow-y-auto space-y-1 text-[10px] leading-snug" data-preset-update-joins>
          <div className="text-text-ghost">Each join: you / the style</div>
          {joins.map((join, i) => (
            <div key={`${join.ref ?? i}-${i}`} data-preset-update-join={join.ref ?? i}>
              <div className="text-text-muted truncate" title={where(join, assetNames)}>
                {where(join, assetNames)}
              </div>
              {(join.lastWord || join.nextWord) && (
                <div className="text-text-ghost truncate">
                  {join.lastWord ?? '…'} | {join.nextWord ?? '…'}
                </div>
              )}
              {join.skipped && <div className="text-text-ghost">{join.skipped}</div>}
              {join.tail !== undefined && (
                <div className="text-text-primary">
                  Tail {side(join.tail, join.tailDb, join.styleTail, join.styleTailDb)}
                  {join.styleSoft && <span className="text-text-ghost"> (soft)</span>}
                </div>
              )}
              {join.leadIn !== undefined && (
                <div className="text-text-primary">Lead-in {side(join.leadIn, undefined, join.styleLeadIn, undefined)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
