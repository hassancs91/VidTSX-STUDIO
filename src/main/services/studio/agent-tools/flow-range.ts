// A Studio shot range as a clip (flows plan §0.1 item 11, W8 Stage 4): what
// the Studio `run_flow` renders and hands the flow as its `video` param.
//
// "Shot N" here is the Nth media clip on the MASTER video track (the first
// `video` track), in timeline order — what the Inspector's clip list shows and
// what an auto-cut leaves behind. A time range is timeline seconds. Either
// maps to SOURCE spans of the footage assets, and the smallest existing path
// makes the file: Stage 3's ffmpeg `trimVideo` on the asset's source when the
// range is one span, `trimVideo` per span plus `concatVideos` when it is
// several (an auto-cut range is several spans of one source). The renderer's
// export bridge (a queue job, a Remotion render) was not used: the shot lanes
// and captions are not part of a B-roll source, and the trim is seconds, not
// minutes. Speed changes are refused — the trim would not match the timeline.

import path from 'path';
import type { StudioMediaAsset, StudioProject } from '../../../../shared/types/studio';
import { concatVideos, trimVideo } from '../../media/video-edit';

export type ShotRange = { fromShot: number; toShot: number } | { fromSec: number; toSec: number };

export interface RangeSegment {
  clipId: string;
  /** 1-based index on the master track. */
  shot: number;
  asset: StudioMediaAsset;
  /** Source seconds of the asset. */
  sourceStart: number;
  sourceEnd: number;
  /** Timeline seconds the segment covers. */
  timelineStart: number;
  timelineEnd: number;
}

export interface RangePlan {
  segments: RangeSegment[];
  /** Where the flow's result belongs back on the timeline. */
  timelineStart: number;
  durationSeconds: number;
  /** `shots 7–9` or `18.0–27.0 s`, for the tool's answer. */
  label: string;
}

const EPS = 1e-6;

/** The master track's media clips in timeline order — what "shot N" counts. */
export function masterClips(project: StudioProject) {
  const track = project.timeline.tracks.find((t) => t.kind === 'video');
  if (!track) return [];
  return [...track.clips].filter((c) => c.assetId && (c.kind === 'video' || c.kind === 'image')).sort((a, b) => a.timelineStart - b.timelineStart);
}

/** Pure: which source spans a range names. A string is the reason it cannot. */
export function planRange(project: StudioProject, range: ShotRange): RangePlan | string {
  const clips = masterClips(project);
  if (clips.length === 0) return 'The master video track has no clips to take a range from.';
  const assetsById = new Map(project.assets.map((a) => [a.id, a]));

  let picked: Array<{ index: number; clip: (typeof clips)[number]; from: number; to: number }>;
  let label: string;
  if ('fromShot' in range) {
    const from = Math.floor(range.fromShot);
    const to = Math.floor(range.toShot);
    if (from < 1 || to < from) return `A shot range runs from 1 upward and toShot must be at or after fromShot (got ${range.fromShot}–${range.toShot}).`;
    if (to > clips.length) return `The master track has ${clips.length} shot${clips.length === 1 ? '' : 's'}; shots ${from}–${to} do not exist.`;
    picked = clips.slice(from - 1, to).map((clip, i) => ({ index: from + i, clip, from: clip.timelineStart, to: clip.timelineStart + clip.duration }));
    label = from === to ? `shot ${from}` : `shots ${from}–${to}`;
  } else {
    const from = Math.max(0, range.fromSec);
    const to = range.toSec;
    if (!(to > from)) return `A time range needs toSec after fromSec (got ${range.fromSec}–${range.toSec}).`;
    picked = clips
      .map((clip, i) => ({ index: i + 1, clip, from: Math.max(from, clip.timelineStart), to: Math.min(to, clip.timelineStart + clip.duration) }))
      .filter((p) => p.to - p.from > EPS);
    if (picked.length === 0) return `No master-track clip lies between ${from} s and ${to} s on the timeline.`;
    label = `${from.toFixed(1)}–${to.toFixed(1)} s`;
  }

  const segments: RangeSegment[] = [];
  for (const { index, clip, from, to } of picked) {
    const asset = clip.assetId ? assetsById.get(clip.assetId) : undefined;
    if (!asset) return `Shot ${index} references an asset that is no longer in the project.`;
    if (asset.kind !== 'video') return `Shot ${index} is ${asset.kind === 'image' ? 'a still image' : asset.kind}; a flow's video input needs footage.`;
    if (clip.speed !== undefined && Math.abs(clip.speed - 1) > EPS) return `Shot ${index} plays at ${clip.speed}× — speed-changed clips are not supported as a flow input.`;
    const sourceIn = clip.sourceIn ?? 0;
    segments.push({
      clipId: clip.id,
      shot: index,
      asset,
      sourceStart: sourceIn + (from - clip.timelineStart),
      sourceEnd: sourceIn + (to - clip.timelineStart),
      timelineStart: from,
      timelineEnd: to,
    });
  }
  const merged = mergeContiguous(segments);
  const durationSeconds = merged.reduce((sum, s) => sum + (s.sourceEnd - s.sourceStart), 0);
  return { segments: merged, timelineStart: merged[0].timelineStart, durationSeconds: Math.round(durationSeconds * 1000) / 1000, label };
}

/** Adjacent segments of one asset whose source spans touch become one trim. */
export function mergeContiguous(segments: RangeSegment[]): RangeSegment[] {
  const out: RangeSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.asset.id === seg.asset.id && Math.abs(last.sourceEnd - seg.sourceStart) < EPS && Math.abs(last.timelineEnd - seg.timelineStart) < EPS) {
      out[out.length - 1] = { ...last, sourceEnd: seg.sourceEnd, timelineEnd: seg.timelineEnd };
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

export interface RenderRangeDeps {
  trim: typeof trimVideo;
  concat: typeof concatVideos;
}

const defaultDeps: RenderRangeDeps = { trim: trimVideo, concat: concatVideos };
let deps: RenderRangeDeps = defaultDeps;
export function setRenderRangeDepsForTests(next: RenderRangeDeps | null): void {
  deps = next ?? defaultDeps;
}

/** Make the clip: one trim, or trims joined. Returns the output path. */
export async function renderRangeClip(
  plan: RangePlan,
  outDir: string,
  output: string,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<string> {
  const outputPath = path.join(outDir, output);
  if (plan.segments.length === 1) {
    const [seg] = plan.segments;
    await deps.trim({ input: seg.asset.path, output: outputPath, startSeconds: seg.sourceStart, endSeconds: seg.sourceEnd, mode: 'precise', ...options });
    return outputPath;
  }
  const parts: string[] = [];
  const total = plan.segments.length;
  for (const [i, seg] of plan.segments.entries()) {
    const part = path.join(outDir, output.replace(/\.mp4$/i, '') + `-part${i + 1}.mp4`);
    await deps.trim({
      input: seg.asset.path,
      output: part,
      startSeconds: seg.sourceStart,
      endSeconds: seg.sourceEnd,
      mode: 'precise',
      ...(options.signal ? { signal: options.signal } : {}),
      onProgress: (f) => options.onProgress?.(((i + f) / (total + 1)) * 1),
    });
    parts.push(part);
  }
  await deps.concat({
    inputs: parts,
    output: outputPath,
    ...(options.signal ? { signal: options.signal } : {}),
    onProgress: (f) => options.onProgress?.((total + f) / (total + 1)),
  });
  return outputPath;
}
