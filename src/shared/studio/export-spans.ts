/**
 * Span planner for the passthrough export engine (docs/export-engines-plan.md
 * Stage 2). Decides FROM THE DOCUMENT ALONE which stretches of a timeline are
 * pure cuts of a video asset — an identity transform the engine may copy with
 * ffmpeg — and which must go through the browser exactly as the standard
 * export renders them. Pure and shared: the Export dialog uses it to state
 * "copies N % of this timeline" before the user commits (D4), the engine to
 * build its work list.
 *
 * Narrowest predicate (Stage 2): ONE visible video track carries the picture;
 * a clip is copyable when it is a video clip of a video asset with no
 * transform, speed, fades or transitions, whose source fills the frame
 * (same aspect as the composition — `objectFit: contain` would letterbox) and
 * stays inside the source's duration. Anything an overlay track or the caption
 * layer paints over is a browser span; gaps in the base track are black (the
 * composition's background). Every widening (Stage 3) is a change here and a
 * re-run of the T1 gate.
 *
 * Stage 3 widening 3 (slice 2): SEVERAL video tracks. Tracks are painted
 * bottom-up in reverse document order (`TimelineComposition.tsx`), so the
 * topmost clip covering a piece is the one on screen; when it is a pure cut
 * it fills the frame and hides every clip below it, so the piece is copied
 * from it alone. A piece whose topmost clip is not a pure cut goes to the
 * browser (a transformed or letterboxed upper clip only PARTLY covers what is
 * below — the browser composites it); a piece no track covers is black.
 * Covered clips still open their files in the browser (every mounted tag
 * extracts frames), so they count for the ceil rule below.
 *
 * Stage 3 widening 1 (2026-09-06): a clip whose only change is its GAIN is
 * still a pure cut of the picture — the video is copied and the gain rides
 * into the one audio pass as `volume=` (Remotion applies a static volume as
 * the same linear multiplier, `TimelineComposition.tsx` volumeProp).
 * Widening 2 (slice 2): audio-track clips no longer send the sound to the
 * browser walk — every track with audible clips is its own chain of source
 * cuts + silence, and the pass sums the chains without normalising, which is
 * what Remotion does with every <Audio>/<Video> of a composition
 * (`amix … normalize=0` in `@remotion/renderer`'s merge filter).
 *
 * Slice 3: a FADE never touches the picture (`TimelineComposition.tsx` reads
 * fadeIn/fadeOut only in volumeProp), so a faded clip is copied and its curve
 * rides into the audio pass; a TRANSITION paints both clips of the boundary
 * only inside its window (the trailing clip fading in over the leading one,
 * or the dip), so only that window goes to the browser and the rest of both
 * clips is copied. The clip geometry comes from the serializer itself
 * (`serializeTimeline` with a stub resolver): the crossfade handles, the
 * shifted `trimBefore`, the dropped clips — so a copied span asks for the
 * same source instant the browser would.
 *
 * Slice 4: SPEED. A clip at rate r ≥ 1 is still a pure cut of the picture,
 * on a scaled time line: output frame n of a span starting at source frame S
 * shows the source frame nearest to (S + r·n)/fps (measured 2026-09-06 on
 * `t5-1080p-cut-speed`: K 899, 902, 905 … every third 59.94 fps frame at
 * 1.5×). The span carries `rate`; `sourceFrame` may then be fractional
 * (trimBefore + r × the offset into the clip, as the composition computes
 * it).
 *
 * Slow motion (r < 1, 2026-09-11): copied too. Measured on the `slow*` seeds
 * (0.5×, 0.25×, 0.1×): slot m shows the source frame nearest, in the stream's
 * integer ticks, to Remotion's own media time `(trimBefore + m·r)/fps`, and a
 * frame that is the nearest for several slots is repeated on each — so the
 * span carries the two whole numbers that arithmetic starts from
 * (`trimBefore`, `clipOffset`) and the engine's recipe places each kept frame
 * on its first slot and fills the rest (`passthrough-slow.ts`).
 */
import type { StudioClip, StudioMediaAsset, StudioProject } from '../types/studio';
import { serializeTimeline } from './serialize';
import { timelineDurationInFrames } from './time-math';

export interface CopySpan {
  kind: 'copy';
  /** First composition frame. */
  from: number;
  frames: number;
  assetId: string;
  assetPath: string;
  /** Source position of `from`, in COMPOSITION frames (Remotion's trimBefore +
   *  offset × rate) — whole unless the clip has a rate. */
  sourceFrame: number;
  /** Slice 4: the clip's playback rate, only when it is not 1 — the copied
   *  span's time line is S + rate·n/fps. */
  rate?: number;
  /** Slow motion (rate < 1): the clip's trimBefore (Remotion's startFrom) and
   *  the slots into the clip at `from` — whole numbers, the exact operands of
   *  the media time the composition asks for. Absent at rate ≥ 1. */
  trimBefore?: number;
  clipOffset?: number;
  /** True when the browser would show the CEIL source frame on this span's
   *  first frame instead of the nearest: the first frame Remotion extracts
   *  after OPENING a source file — the composition opening mid-source (T1
   *  leg 3) or the first clip of a file that the timeline has not shown
   *  before (measured 2026-09-06 on the `t5-1080p-cut-files*` seeds: a cut to
   *  a new file shows K 900 where nearest is 899; a return to a file already
   *  opened shows the nearest, like a same-file cut). A rate ≥ 1 rule: a SLOW
   *  clip that opens its file shows the nearest on its first slot (measured
   *  2026-09-11 at 0.1× and 0.25× on the `slow-open*` seeds: K 2817 where the
   *  ceil is 2818), so it is never set on a span whose rate is under 1. */
  firstFrameCeil: boolean;
}

export interface BrowserSpan {
  kind: 'browser';
  from: number;
  frames: number;
  /** Why it could not be copied — the first reason found, for the log. */
  reason: string;
}

export interface BlackSpan {
  kind: 'black';
  from: number;
  frames: number;
}

export type ExportSpan = CopySpan | BrowserSpan | BlackSpan;

export interface ExportSpanPlan {
  spans: ExportSpan[];
  totalFrames: number;
  copiedFrames: number;
  /** When nothing is copied: the reason that applies to the whole timeline. */
  reason?: string;
}

/** Percent of the timeline's frames the plan copies, whole number. */
export function copiedPercent(plan: ExportSpanPlan): number {
  if (plan.totalFrames <= 0) return 0;
  return Math.round((plan.copiedFrames / plan.totalFrames) * 100);
}

const EPS = 1e-6;

function isIdentityTransform(clip: StudioClip): boolean {
  const t = clip.transform;
  if (!t) return true;
  return (
    !(t.x ?? 0) && !(t.y ?? 0) && !(t.rotation ?? 0) &&
    (t.scale === undefined || t.scale === 1) &&
    (t.opacity === undefined || t.opacity === 1)
  );
}

/** Pure: why a clip cannot be copied, or null when it is a pure cut. */
export function copyBlocker(clip: StudioClip, asset: StudioMediaAsset | undefined, settings: { width: number; height: number; fps: number }): string | null {
  if (clip.kind !== 'video') return `${clip.kind} clip`;
  if (!asset) return 'missing asset';
  if (asset.kind !== 'video') return `${asset.kind} asset`;
  const rate = clip.speed !== undefined && clip.speed !== 1 ? clip.speed : 1;
  if (!(rate > 0)) return 'speed';
  if (!isIdentityTransform(clip)) return 'transform';
  if (!asset.probe.width || !asset.probe.height) return 'unknown source size';
  const sourceAspect = asset.probe.width / asset.probe.height;
  const compAspect = settings.width / settings.height;
  if (Math.abs(sourceAspect - compAspect) > 1e-3) return 'aspect ratio (letterboxed)';
  // The last output slot sits one composition frame before the clip's end, so
  // a clip may overrun the source by up to half a composition frame and every
  // slot still has a nearest source frame (measured 2026-09-06: a seeded 3 h
  // project's millisecond-rounded clip ends overran by 0.3–0.5 ms and sent
  // 5 % of an all-cuts timeline to the browser). The engine counts every
  // piece's frames anyway and sends a short one back to the browser. A sped
  // clip consumes `rate` source seconds per timeline second (slice 4), and its
  // slots sit `rate` composition frames apart.
  const sourceEnd = (clip.sourceIn ?? 0) + clip.duration * rate;
  if (sourceEnd > asset.probe.duration + (0.5 * rate) / settings.fps + EPS) return 'runs past the source end';
  return null;
}

interface Piece {
  from: number;
  to: number;
}

export function planExportSpans(project: StudioProject, durationInFrames?: number): ExportSpanPlan {
  const { fps } = project.settings;
  const totalFrames = durationInFrames ?? timelineDurationInFrames(project.timeline, fps);
  const whole = (reason: string): ExportSpanPlan => ({
    spans: totalFrames > 0 ? [{ kind: 'browser', from: 0, frames: totalFrames, reason }] : [],
    totalFrames,
    copiedFrames: 0,
    reason,
  });
  if (!(fps > 0) || totalFrames <= 0) return { spans: [], totalFrames: 0, copiedFrames: 0, reason: 'empty timeline' };

  const hasVideoTrack = project.timeline.tracks.some((t) => !t.hidden && t.kind === 'video' && t.clips.length > 0);
  if (!hasVideoTrack) return whole('no video track');
  if (project.captions?.enabled) return whole('captions');

  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const docClips = new Map(project.timeline.tracks.flatMap((t) => t.clips).map((c) => [c.id, c]));
  // The serialization the composition receives (hidden tracks and unresolvable
  // clips already dropped, transition handles applied); the stub resolver only
  // says whether the asset exists.
  const timeline = serializeTimeline(project, (id) => (byId.has(id) ? id : null));
  const settings = project.settings;

  // Anything painted over the video tracks: overlay-track clips.
  const touched: Piece[] = timeline.tracks
    .filter((t) => t.kind === 'overlay' || t.kind === 'caption')
    .flatMap((t) => t.clips.map((c) => ({ from: c.from, to: c.from + c.durationInFrames })));

  // Every video track's clips, document order = top of the stack first.
  const layers = timeline.tracks
    .filter((t) => t.kind === 'video')
    .map((track) =>
      track.clips
        .map((sc) => {
          const doc = docClips.get(sc.id);
          const asset = doc?.assetId ? byId.get(doc.assetId) : undefined;
          const blocker = doc ? copyBlocker(doc, asset, settings) : 'unknown clip';
          const from = sc.from;
          const to = from + sc.durationInFrames;
          // A transition's window: both clips of the boundary paint there.
          const windows: Piece[] = [];
          if (sc.transitionIn && sc.transitionIn.frames > 0) windows.push({ from, to: Math.min(to, from + sc.transitionIn.frames) });
          if (sc.transitionOut && sc.transitionOut.frames > 0) windows.push({ from: Math.max(from, to - sc.transitionOut.frames), to });
          const rate = sc.playbackRate !== undefined && sc.playbackRate !== 1 ? sc.playbackRate : 1;
          return { sc, from, to, asset, blocker, windows, trimBefore: sc.trimBefore ?? 0, rate };
        })
        .filter((c) => c.to > c.from)
        .sort((a, b) => a.from - b.from),
    );

  // Boundaries: every clip edge and transition edge on every video track and every touched edge.
  const cuts = new Set<number>([0, totalFrames]);
  for (const layer of layers) {
    for (const c of layer) {
      cuts.add(c.from);
      cuts.add(c.to);
      for (const w of c.windows) {
        cuts.add(w.from);
        cuts.add(w.to);
      }
    }
  }
  for (const t of touched) {
    cuts.add(t.from);
    cuts.add(t.to);
  }
  const edges = [...cuts].filter((f) => f >= 0 && f <= totalFrames).sort((a, b) => a - b);

  const spans: ExportSpan[] = [];
  let copiedFrames = 0;
  // Source files the browser has opened before a given piece, for the ceil rule
  // above: every clip mounted so far (copied, rendered or covered) has opened its file.
  const opened = new Set<string>();
  const push = (span: ExportSpan) => {
    const last = spans[spans.length - 1];
    if (last && last.kind === 'browser' && span.kind === 'browser' && last.from + last.frames === span.from) {
      last.frames += span.frames;
      return;
    }
    spans.push(span);
  };
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const frames = to - from;
    if (frames <= 0) continue;
    if (touched.some((t) => t.from < to && from < t.to)) {
      push({ kind: 'browser', from, frames, reason: 'overlay' });
      continue;
    }
    // The stack of clips covering this piece, topmost first (clips on one
    // track overlap only inside a transition window, which is a browser piece).
    const stack = layers.flatMap((layer) => {
      const c = layer.find((x) => x.from <= from && to <= x.to);
      return c ? [c] : [];
    });
    const covering = stack[0];
    if (!covering) {
      push({ kind: 'black', from, frames });
      continue;
    }
    const opensFile = covering.asset ? !opened.has(covering.asset.path) : false;
    for (const c of stack) if (c.asset) opened.add(c.asset.path);
    if (covering.blocker) {
      push({ kind: 'browser', from, frames, reason: covering.blocker });
      continue;
    }
    if (covering.windows.some((w) => w.from < to && from < w.to)) {
      push({ kind: 'browser', from, frames, reason: 'transition' });
      continue;
    }
    const asset = covering.asset as StudioMediaAsset;
    const sourceFrame = covering.trimBefore + (from - covering.from) * covering.rate;
    push({
      kind: 'copy',
      from,
      frames,
      assetId: asset.id,
      assetPath: asset.path,
      sourceFrame,
      ...(covering.rate !== 1 ? { rate: covering.rate } : {}),
      ...(covering.rate < 1 ? { trimBefore: covering.trimBefore, clipOffset: from - covering.from } : {}),
      firstFrameCeil: opensFile && sourceFrame > 0 && covering.rate >= 1,
    });
    copiedFrames += frames;
  }

  const plan: ExportSpanPlan = { spans, totalFrames, copiedFrames };
  if (copiedFrames === 0) {
    const first = spans.find((s): s is BrowserSpan => s.kind === 'browser');
    plan.reason = first?.reason ?? 'nothing to copy';
  }
  return plan;
}

export { planExportAudio, type AudioSegment, type ExportAudioPlan } from './export-audio';
