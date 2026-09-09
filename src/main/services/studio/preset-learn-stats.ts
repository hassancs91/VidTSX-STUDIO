// PURE measurement for "learn from this video" (V1 completion plan §2.5):
// the timeline stats, the style knobs they imply and the diff against the
// preset. No fs, no provider, no clock. The text (stat lines, summary, the
// "Learned from" section) and the short-edit rule live in
// preset-learn-format.ts; the ONE LLM call lives in learn-from-project.ts.

import type { StudioClip, StudioProject } from '../../../shared/types/studio';
import type {
  StudioPresetCaptions,
  StudioPresetKnobChange,
  StudioPresetLearnStats,
  StudioPresetMusicBed,
  StudioPresetPacing,
  StudioPresetStyle,
} from '../../../shared/types/studio-preset';
import { timelineDuration } from '../../../shared/studio/time-math';
import { formatClock, rateKnobsWithheld } from './preset-learn-format';

/** Word-emphasis templates read as "karaoke"; the rest as "block". */
const KARAOKE_TEMPLATES = new Set([
  'karaoke',
  'word-pop',
  'one-word-punch',
  'bounce-in',
  'gradient-active',
  'dim-past',
  'bold-stroke',
]);

/** Below this the numbers say nothing — no knob is proposed. */
const MIN_SECONDS_FOR_KNOBS = 10;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function perMinute(count: number, seconds: number): number {
  return seconds > 0 ? round1((count / seconds) * 60) : 0;
}

function isFootage(clip: StudioClip): boolean {
  return clip.kind === 'video';
}

export function computeLearnStats(project: StudioProject): StudioPresetLearnStats {
  const { timeline } = project;
  const totalSeconds = round1(timelineDuration(timeline));
  const master = timeline.tracks.find((t) => t.kind === 'video');
  const masterClips = [...(master?.clips ?? [])].sort((a, b) => a.timelineStart - b.timelineStart);
  const allClips = timeline.tracks.flatMap((t) => t.clips.map((clip) => ({ clip, track: t })));

  const masterClipCount = masterClips.length;
  const meanClipSeconds =
    masterClipCount > 0 ? round1(masterClips.reduce((s, c) => s + c.duration, 0) / masterClipCount) : 0;
  const cutsPerMinute = perMinute(Math.max(0, masterClipCount - 1), totalSeconds);

  const shotCount = allClips.filter(({ clip }) => clip.kind === 'tsx').length;
  const brollCount = allClips.filter(
    ({ clip, track }) => track.kind === 'overlay' && (clip.kind === 'video' || clip.kind === 'image'),
  ).length;
  const sfxCount = allClips.filter(({ clip }) => clip.kind === 'sfx').length;

  // A music bed: an audio-lane clip of an untranscribed AUDIO asset covering
  // a good part of the edit. The footage's own audio never counts (it is a
  // video asset, or transcribed).
  const assetsById = new Map(project.assets.map((a) => [a.id, a]));
  let musicBed: StudioPresetMusicBed = 'none';
  for (const { clip, track } of allClips) {
    if (track.kind !== 'audio' || clip.kind !== 'audio' || !clip.assetId) continue;
    const asset = assetsById.get(clip.assetId);
    if (!asset || asset.kind !== 'audio' || asset.transcript) continue;
    if (totalSeconds > 0 && clip.duration / totalSeconds < 0.4) continue;
    musicBed = (clip.gain ?? 1) < 0.5 ? 'quiet' : 'present';
    break;
  }

  let captions: StudioPresetCaptions = 'none';
  let captionTemplateId: string | undefined;
  if (project.captions?.enabled) {
    captionTemplateId = project.captions.templateId;
    const item = captionTemplateId.split('/').pop() ?? captionTemplateId;
    captions = KARAOKE_TEMPLATES.has(item) ? 'karaoke' : 'block';
  }

  const transitionCounts = new Map<string, number>();
  for (const { clip } of allClips) {
    if (clip.transitionOut) {
      transitionCounts.set(clip.transitionOut.kind, (transitionCounts.get(clip.transitionOut.kind) ?? 0) + 1);
    }
  }
  const transitions = [...transitionCounts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => a.kind.localeCompare(b.kind));

  // Intro = master-lane time before the first footage clip; outro = time
  // after the last footage clip ends. No footage at all = no intro/outro.
  const footage = masterClips.filter(isFootage);
  const introSeconds = footage.length > 0 ? round1(Math.max(0, footage[0].timelineStart)) : 0;
  const lastFootage = footage.length > 0 ? footage[footage.length - 1] : undefined;
  const outroSeconds = lastFootage
    ? round1(Math.max(0, totalSeconds - (lastFootage.timelineStart + lastFootage.duration)))
    : 0;

  let userClipCount = 0;
  let agentClipCount = 0;
  for (const { clip } of allClips) {
    if (clip.origin?.by === 'agent') agentClipCount += 1;
    else userClipCount += 1;
  }

  let proposalsApplied = 0;
  let proposalsRejected = 0;
  let cutItemsProposed = 0;
  let cutItemsRejected = 0;
  let cutItemsAdjusted = 0;
  let removedSeconds = 0;
  for (const proposal of project.proposals) {
    if (proposal.status === 'applied' || proposal.status === 'partial') proposalsApplied += 1;
    else if (proposal.status === 'rejected') proposalsRejected += 1;
    if (proposal.kind !== 'cut-plan') continue;
    for (const item of proposal.items) {
      cutItemsProposed += 1;
      if (item.status === 'rejected') cutItemsRejected += 1;
      if (item.adjusted) cutItemsAdjusted += 1;
      if (
        item.status === 'accepted' &&
        (proposal.status === 'applied' || proposal.status === 'partial') &&
        item.sourceStart !== undefined &&
        item.sourceEnd !== undefined
      ) {
        removedSeconds += Math.max(0, item.sourceEnd - item.sourceStart);
      }
    }
  }

  return {
    totalSeconds,
    masterClipCount,
    cutsPerMinute,
    meanClipSeconds,
    removedSeconds: round1(removedSeconds),
    shotCount,
    shotsPerMinute: perMinute(shotCount, totalSeconds),
    brollCount,
    sfxCount,
    sfxPerMinute: perMinute(sfxCount, totalSeconds),
    musicBed,
    captions,
    ...(captionTemplateId ? { captionTemplateId } : {}),
    transitions,
    introSeconds,
    outroSeconds,
    userClipCount,
    agentClipCount,
    proposalsApplied,
    proposalsRejected,
    cutItemsProposed,
    cutItemsRejected,
    cutItemsAdjusted,
  };
}

/** The pacing the cut density implies; undefined when there is too little to say. */
export function inferPacing(stats: StudioPresetLearnStats): StudioPresetPacing | undefined {
  if (stats.masterClipCount < 2 || stats.totalSeconds < MIN_SECONDS_FOR_KNOBS) return undefined;
  if (stats.cutsPerMinute >= 8 || stats.meanClipSeconds <= 5) return 'tight';
  if (stats.cutsPerMinute <= 2 && stats.meanClipSeconds >= 15) return 'relaxed';
  return 'normal';
}

function numberDiffers(from: number | undefined, to: number, tolerance: number): boolean {
  if (from === undefined) return to > 0;
  return Math.abs(from - to) > Math.max(tolerance, from * 0.25);
}

function sameList(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/**
 * The knob changes the measurement justifies, each with its numbers. Short
 * edits (< 10 s) propose nothing; under 30 s the per-minute rate knobs
 * (pacing, shots/min, SFX/min) are withheld — `rateKnobsWithheldNote` says
 * so on the card; a knob the preset never set is proposed only when the
 * measurement is non-trivial.
 */
export function diffPresetKnobs(style: StudioPresetStyle, stats: StudioPresetLearnStats): StudioPresetKnobChange[] {
  if (stats.totalSeconds < MIN_SECONDS_FOR_KNOBS) return [];
  const changes: StudioPresetKnobChange[] = [];
  if (!rateKnobsWithheld(stats)) changes.push(...diffRateKnobs(style, stats));
  if (style.musicBed !== undefined ? stats.musicBed !== style.musicBed : stats.musicBed !== 'none') {
    changes.push({
      key: 'musicBed',
      ...(style.musicBed ? { from: style.musicBed } : {}),
      to: stats.musicBed,
      reason: stats.musicBed === 'none' ? 'no music bed on the audio lanes' : `a ${stats.musicBed} music bed runs under the edit`,
    });
  }
  if (style.captions !== undefined ? stats.captions !== style.captions : stats.captions !== 'none') {
    changes.push({
      key: 'captions',
      ...(style.captions ? { from: style.captions } : {}),
      to: stats.captions,
      reason: stats.captions === 'none' ? 'captions are off' : `captions on with ${stats.captionTemplateId ?? 'the default template'}`,
    });
  }
  const kinds = stats.transitions.map((t) => t.kind);
  if (style.transitions !== undefined ? !sameList(style.transitions, kinds) : kinds.length > 0) {
    changes.push({
      key: 'transitions',
      ...(style.transitions ? { from: style.transitions } : {}),
      to: kinds,
      reason: kinds.length > 0 ? stats.transitions.map((t) => `${t.count}× ${t.kind}`).join(', ') : 'hard cuts only',
    });
  }
  const intro = Math.round(stats.introSeconds);
  if (numberDiffers(style.introSeconds, intro, 1)) {
    changes.push({
      key: 'introSeconds',
      ...(style.introSeconds !== undefined ? { from: style.introSeconds } : {}),
      to: intro,
      reason: intro > 0 ? `${stats.introSeconds} s before the first footage clip` : 'the footage starts at 0:00',
    });
  }
  const outro = Math.round(stats.outroSeconds);
  if (numberDiffers(style.outroSeconds, outro, 1)) {
    changes.push({
      key: 'outroSeconds',
      ...(style.outroSeconds !== undefined ? { from: style.outroSeconds } : {}),
      to: outro,
      reason: outro > 0 ? `${stats.outroSeconds} s after the last footage clip` : 'the edit ends on the footage',
    });
  }
  return changes;
}

/** Pacing, shots/min and SFX/min — the knobs that are rates over the length. */
function diffRateKnobs(style: StudioPresetStyle, stats: StudioPresetLearnStats): StudioPresetKnobChange[] {
  const changes: StudioPresetKnobChange[] = [];
  const pacing = inferPacing(stats);
  if (pacing && pacing !== style.pacing) {
    changes.push({
      key: 'pacing',
      ...(style.pacing ? { from: style.pacing } : {}),
      to: pacing,
      reason: `${stats.cutsPerMinute} cuts/min on the master lane, mean clip ${stats.meanClipSeconds} s${stats.removedSeconds > 0 ? `, ${stats.removedSeconds} s removed by accepted cuts` : ''}`,
    });
  }
  if (numberDiffers(style.shotsPerMinute, stats.shotsPerMinute, 0.5)) {
    changes.push({
      key: 'shotsPerMinute',
      ...(style.shotsPerMinute !== undefined ? { from: style.shotsPerMinute } : {}),
      to: stats.shotsPerMinute,
      reason: `${stats.shotCount} shot${stats.shotCount === 1 ? '' : 's'} in ${formatClock(stats.totalSeconds)}`,
    });
  }
  if (numberDiffers(style.sfxPerMinute, stats.sfxPerMinute, 0.5)) {
    changes.push({
      key: 'sfxPerMinute',
      ...(style.sfxPerMinute !== undefined ? { from: style.sfxPerMinute } : {}),
      to: stats.sfxPerMinute,
      reason: `${stats.sfxCount} sound effect${stats.sfxCount === 1 ? '' : 's'} in ${formatClock(stats.totalSeconds)}`,
    });
  }
  return changes;
}

export function applyKnobChanges(style: StudioPresetStyle, changes: readonly StudioPresetKnobChange[]): StudioPresetStyle {
  const next: Record<string, unknown> = { ...style };
  for (const change of changes) next[change.key] = change.to;
  return next as StudioPresetStyle;
}
