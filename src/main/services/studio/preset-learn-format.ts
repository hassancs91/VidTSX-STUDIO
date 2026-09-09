// Formatting for "learn from this video" (V1 completion plan §2.5) and the
// short-edit rule: the stat lines, the summary sentence, the knob line and the
// "Learned from" section — the card, the LLM prompt and PRESET.md all read the
// same lines. Pure: no fs, no clock. The measurement lives in
// preset-learn-stats.ts.

import type { StudioPresetKnobChange, StudioPresetLearnStats } from '../../../shared/types/studio-preset';

/**
 * Below this the per-minute RATES are noise (W5 read a 12 s short as
 * "96.6 cuts/min"): pacing, shots/min and SFX/min are withheld and the
 * summary says so; the count-and-flag knobs (music, captions, transitions,
 * intro, outro) still hold on a short edit.
 */
export const MIN_SECONDS_FOR_RATE_KNOBS = 30;

/** True when the edit is too short for its per-minute rates to mean anything. */
export function rateKnobsWithheld(stats: Pick<StudioPresetLearnStats, 'totalSeconds'>): boolean {
  return stats.totalSeconds < MIN_SECONDS_FOR_RATE_KNOBS;
}

/** The one-line explanation the card and the learned section carry. */
export function rateKnobsWithheldNote(stats: Pick<StudioPresetLearnStats, 'totalSeconds'>): string {
  return `Edit under ${formatClock(MIN_SECONDS_FOR_RATE_KNOBS)} (${formatClock(stats.totalSeconds)}) — pacing, shots/min and SFX/min are not proposed from so little.`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function knobValue(v: string | number | string[] | undefined): string {
  if (v === undefined) return 'unset';
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : 'none';
  return String(v);
}

/** The measurement as bullet lines — the card, the LLM prompt and the
 *  learned section all read the same lines. */
export function formatStatsLines(stats: StudioPresetLearnStats): string[] {
  return [
    `Length ${formatClock(stats.totalSeconds)} · ${stats.masterClipCount} clip${stats.masterClipCount === 1 ? '' : 's'} on the master lane · ${stats.cutsPerMinute} cuts/min · mean clip ${stats.meanClipSeconds} s${stats.removedSeconds > 0 ? ` · ${stats.removedSeconds} s removed by accepted cuts` : ''}`,
    `Shots ${stats.shotCount} (${stats.shotsPerMinute}/min) · b-roll ${stats.brollCount} · SFX ${stats.sfxCount} (${stats.sfxPerMinute}/min) · music bed ${stats.musicBed}`,
    `Captions ${stats.captions}${stats.captionTemplateId ? ` (${stats.captionTemplateId})` : ''} · transitions ${stats.transitions.length > 0 ? stats.transitions.map((t) => `${t.count}× ${t.kind}`).join(', ') : 'none'} · intro ${stats.introSeconds} s · outro ${stats.outroSeconds} s`,
    `Review: ${stats.proposalsApplied} proposal${stats.proposalsApplied === 1 ? '' : 's'} applied, ${stats.proposalsRejected} rejected · ${stats.cutItemsRejected} of ${stats.cutItemsProposed} proposed cut items rejected by hand, ${stats.cutItemsAdjusted} adjusted · clips placed by the user ${stats.userClipCount}, by the assistant ${stats.agentClipCount}`,
  ];
}

/** One sentence with the headline numbers (plus the short-edit caveat). */
export function formatStatsSummary(stats: StudioPresetLearnStats): string {
  const line = `${formatClock(stats.totalSeconds)} long, ${stats.cutsPerMinute} cuts/min (mean clip ${stats.meanClipSeconds} s), ${stats.shotCount} shot${stats.shotCount === 1 ? '' : 's'}, ${stats.sfxCount} SFX, music bed ${stats.musicBed}, captions ${stats.captions}.`;
  return rateKnobsWithheld(stats) ? `${line} ${rateKnobsWithheldNote(stats)}` : line;
}

export function formatKnobChange(change: StudioPresetKnobChange): string {
  return `${change.key} ${knobValue(change.from)} → ${knobValue(change.to)} (${change.reason})`;
}

/** The markdown section accept appends to PRESET.md. */
export function buildLearnedSection(input: {
  projectName: string;
  date: string; // YYYY-MM-DD
  summary: string;
  stats: StudioPresetLearnStats;
  changes: readonly StudioPresetKnobChange[];
}): string {
  const lines = [`## Learned from ${input.projectName} on ${input.date}`, '', input.summary.trim(), ''];
  for (const line of formatStatsLines(input.stats)) lines.push(`- ${line}`);
  if (rateKnobsWithheld(input.stats)) lines.push(`- ${rateKnobsWithheldNote(input.stats)}`);
  lines.push(
    input.changes.length > 0
      ? `- Knobs: ${input.changes.map(formatKnobChange).join('; ')}`
      : '- Knobs: unchanged — the edit matched the preset',
  );
  return lines.join('\n');
}
