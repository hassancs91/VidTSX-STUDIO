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
        <div className="max-h-[200px] overflow-y-auto">
          <table className="w-full text-[10px] leading-snug" data-preset-update-joins>
            <thead>
              <tr className="text-text-ghost text-left">
                <th className="pr-2 font-normal">Join</th>
                <th className="pr-2 font-normal">Tail you / style</th>
                <th className="font-normal">Lead-in you / style</th>
              </tr>
            </thead>
            <tbody>
              {joins.map((join, i) => (
                <tr key={`${join.ref ?? i}-${i}`} className="align-top" data-preset-update-join={join.ref ?? i}>
                  <td className="pr-2 text-text-muted">
                    <div className="whitespace-nowrap">{where(join, assetNames)}</div>
                    {(join.lastWord || join.nextWord) && (
                      <div className="text-text-ghost truncate max-w-[140px]">
                        {join.lastWord ?? '…'} | {join.nextWord ?? '…'}
                      </div>
                    )}
                    {join.skipped && <div className="text-text-ghost">{join.skipped}</div>}
                  </td>
                  <td className="pr-2 text-text-primary whitespace-nowrap">
                    {side(join.tail, join.tailDb, join.styleTail, join.styleTailDb)}
                    {join.tail !== undefined && join.styleSoft && <span className="text-text-ghost"> (soft)</span>}
                  </td>
                  <td className="text-text-primary whitespace-nowrap">
                    {side(join.leadIn, undefined, join.styleLeadIn, undefined)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
