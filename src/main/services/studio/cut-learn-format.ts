// The cut-knob half of the learn card (plan T1 "the learning signal", B4):
// the lines the card, the summary prompt and PRESET.md read, and the reason
// on each `cut.<knob>` change. Both the user's MEDIANS (what they kept) and
// the FITTED values (the knob that reproduces their edges through the
// snapper's own rules) are shown — nothing is inferred silently. Pure.

import type { CutLearnChange, CutLearnReport } from '../../../shared/types/studio-cut-learn';
import type { StudioPresetKnobChange } from '../../../shared/types/studio-preset';

function sec(n: number | undefined): string {
  return n === undefined ? '?' : `${Number(n.toFixed(3))} s`;
}

function db(n: number | undefined): string {
  return n === undefined ? '?' : `${Number(n.toFixed(1))} dB`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface CutLearnLinesOptions {
  /** The project's own cut style (Project settings) overrides the preset's. */
  projectOverride?: boolean;
  /** Assets whose audio or transcript could not be read (their joins teach nothing). */
  unreadable?: string[];
}

/** The card lines: counts, the medians against the style's own edges, the fitted values, the notes. */
export function formatCutLearnLines(report: CutLearnReport, opts: CutLearnLinesOptions = {}): string[] {
  const { medians, fitted } = report;
  const lines = [
    `Cut: learned from ${plural(report.joins, 'join')} you trimmed (${plural(report.headEdges, 'lead-in')}, ${plural(report.tailEdges, 'tail')}) — learned from your trims; Transcript deletes count once you trim them.`,
  ];
  if (report.headEdges > 0) {
    const fit = fitted.head !== undefined ? `; head ${sec(fitted.head)} reproduces your edges` : '';
    lines.push(
      `Lead-in: you kept a median ${sec(medians.leadIn)} before the first word (the style keeps ${sec(medians.styleLeadIn)})${fit}.`,
    );
  }
  if (report.tailEdges > 0) {
    const fits: string[] = [];
    if (fitted.minTail !== undefined) fits.push(`minTail ${sec(fitted.minTail)}`);
    if (fitted.margin !== undefined) fits.push(`margin ${db(fitted.margin)}`);
    const fit = fits.length > 0 ? `; ${fits.join(' and ')} reproduce your edges` : '';
    const cap = fitted.maxTail !== undefined ? `; maxTail at least ${sec(fitted.maxTail)}` : '';
    lines.push(
      `Tail: you kept a median ${sec(medians.tail)} after the last word, cut ${db(medians.tailDb)} over the floor (the style: ${sec(medians.styleTail)}, ${db(medians.styleTailDb)})${fit}${cap}.`,
    );
  }
  for (const name of opts.unreadable ?? []) {
    lines.push(`Could not read the audio or transcript of ${name} — its joins teach nothing.`);
  }
  lines.push(...report.notes);
  if (opts.projectOverride && report.changes.length > 0) {
    lines.push(
      "This project's own cut style (Project settings) overrides the preset: accepting teaches the preset; this project keeps its override until you clear it there.",
    );
  }
  return lines;
}

/** One `cut.<knob>` change for the card, with the numbers behind it. */
export function cutKnobChange(change: CutLearnChange, report: CutLearnReport): StudioPresetKnobChange {
  const { medians } = report;
  const on = `at ${plural(change.samples, 'join')}`;
  let reason: string;
  switch (change.knob) {
    case 'head':
      reason = `median lead-in ${sec(medians.leadIn)} ${on} (the style kept ${sec(medians.styleLeadIn)})`;
      break;
    case 'maxTail':
      reason = `at least ${sec(change.to)} — only known up to the longest tail you kept`;
      break;
    default:
      reason = `median tail ${sec(medians.tail)}, ${db(medians.tailDb)} over the floor ${on} (the style: ${sec(medians.styleTail)}, ${db(medians.styleTailDb)})`;
  }
  return { key: `cut.${change.knob}`, from: change.from, to: change.to, reason };
}
