/**
 * T8 "Check this export": where to probe. The export's timeline (a range
 * export's trimmed document, t = 0 at the range start) says, for every second,
 * which camera clip is drawn, where in the camera file it is, and where on the
 * frame its picture sits — so probes go only where the camera picture is
 * visible, and only that region is compared (the export's box mapped back to
 * the camera frame through the clip's transform). Opaque cutaway shots and
 * clips drawn over the picture are skipped with a reason; transparent overlay
 * shots are allowed and named on the probe (they may lower the match).
 *
 * Transform semantics match TimelineComposition / canvas-transform.ts: each
 * visual clip is a composition-sized element, `translate(x, y) scale(s)` about
 * its centre, the media drawn `objectFit: contain` inside it; tracks[0] paints
 * on top.
 */
import type { StudioClip, StudioClipTransform, StudioMediaAsset, StudioProject } from '../types/studio';

export interface SyncRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SyncSize {
  width: number;
  height: number;
}

export interface SyncReference {
  assetId: string;
  path: string;
  width: number;
  height: number;
}

export interface SyncProbe {
  /** Export seconds, on a frame boundary (= frame / fps). */
  t: number;
  frame: number;
  clipId: string;
  /** Where this export moment sits in the camera file (seconds). */
  sourceSec: number;
  /** The visible camera picture in export pixels, and the same area in camera pixels (even values). */
  exportRect: SyncRect;
  sourceRect: SyncRect;
  /** Transparent overlay shots drawn above the picture here. */
  overlays: string[];
}

export interface SyncSkip {
  from: number;
  to: number;
  reason: string;
}

export interface SyncProbePlan {
  reference: SyncReference | null;
  probes: SyncProbe[];
  skipped: SyncSkip[];
  /** Total seconds of probe start times available. */
  visibleSec: number;
}

export interface SyncPlanOptions {
  durationSec: number;
  fps: number;
  /** The exported file's pixel size. */
  output: SyncSize;
  count?: number;
  windowSec?: number;
  edgeSec?: number;
}

export const SYNC_PROBE_COUNT = 16;
export const SYNC_WINDOW_SEC = 2;
const EDGE_SEC = 0.25;
const MIN_SIDE_PX = 64;

type Span = [number, number];

// `+ 0` turns a −0 (ceil of a tiny negative) into 0.
const ceilEven = (v: number) => Math.ceil(v / 2 - 1e-6) * 2 + 0;
const floorEven = (v: number) => Math.floor(v / 2 + 1e-6) * 2 + 0;
const roundEven = (v: number) => Math.round(v / 2) * 2 + 0;
const ms = (v: number) => Math.round(v * 1000) / 1000;

/** The media picture's box in export pixels (unclipped). */
function pictureBox(comp: SyncSize, output: SyncSize, media: SyncSize, transform: StudioClipTransform | undefined): SyncRect {
  const so = output.width / comp.width;
  const scale = transform?.scale ?? 1;
  const w = comp.width * scale;
  const h = comp.height * scale;
  const k = Math.min(w / media.width, h / media.height);
  const pw = media.width * k;
  const ph = media.height * k;
  const cx = comp.width / 2 + (transform?.x ?? 0);
  const cy = comp.height / 2 + (transform?.y ?? 0);
  return { x: (cx - pw / 2) * so, y: (cy - ph / 2) * so, width: pw * so, height: ph * so };
}

/** Pure: the visible part of a clip's picture in export pixels and in media pixels; null when off-frame. */
export function pictureRects(
  comp: SyncSize,
  output: SyncSize,
  media: SyncSize,
  transform: StudioClipTransform | undefined,
): { exportRect: SyncRect; sourceRect: SyncRect } | null {
  const box = pictureBox(comp, output, media, transform);
  const x0 = ceilEven(Math.max(0, box.x));
  const y0 = ceilEven(Math.max(0, box.y));
  const x1 = floorEven(Math.min(output.width, box.x + box.width));
  const y1 = floorEven(Math.min(output.height, box.y + box.height));
  if (x1 <= x0 || y1 <= y0) return null;
  const toSrcX = (v: number) => ((v - box.x) / box.width) * media.width;
  const toSrcY = (v: number) => ((v - box.y) / box.height) * media.height;
  const sx = Math.max(0, roundEven(toSrcX(x0)));
  const sy = Math.max(0, roundEven(toSrcY(y0)));
  const sw = Math.min(media.width - sx, roundEven(toSrcX(x1) - toSrcX(x0)));
  const sh = Math.min(media.height - sy, roundEven(toSrcY(y1) - toSrcY(y0)));
  return { exportRect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, sourceRect: { x: sx, y: sy, width: sw, height: sh } };
}

function intersects(a: SyncRect, b: SyncRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function subtract(spans: Span[], cut: Span): Span[] {
  const out: Span[] = [];
  for (const [a, b] of spans) {
    if (cut[1] <= a || cut[0] >= b) out.push([a, b]);
    else {
      if (cut[0] > a) out.push([a, cut[0]]);
      if (cut[1] < b) out.push([cut[1], b]);
    }
  }
  return out;
}

function mediaSize(asset: StudioMediaAsset | undefined, comp: SyncSize): SyncSize {
  const w = asset?.probe?.width;
  const h = asset?.probe?.height;
  return w && h ? { width: w, height: h } : comp;
}

const end = (c: StudioClip) => c.timelineStart + c.duration;

/** Pure: the reference camera file and the probes for one export. */
export function planSyncProbes(project: StudioProject, options: SyncPlanOptions): SyncProbePlan {
  const { durationSec, fps, output } = options;
  const count = options.count ?? SYNC_PROBE_COUNT;
  const windowSec = options.windowSec ?? SYNC_WINDOW_SEC;
  const edge = options.edgeSec ?? EDGE_SEC;
  const comp = { width: project.settings.width, height: project.settings.height };
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  const visual = project.timeline.tracks.map((t) => (t.hidden || (t.kind !== 'video' && t.kind !== 'overlay') ? [] : t.clips));

  const firstCamera = visual
    .flat()
    .filter((c) => c.kind === 'video' && c.assetId && (c.speed ?? 1) === 1 && assets.get(c.assetId)?.probe?.hasAudio)
    .filter((c) => end(c) > 0 && c.timelineStart < durationSec)
    .sort((a, b) => a.timelineStart - b.timelineStart)[0];
  const refAsset = firstCamera?.assetId ? assets.get(firstCamera.assetId) : undefined;
  if (!refAsset) return { reference: null, probes: [], skipped: [], visibleSec: 0 };
  const media = mediaSize(refAsset, comp);
  const reference: SyncReference = { assetId: refAsset.id, path: refAsset.path, ...media };

  const skipped: SyncSkip[] = [];
  const free: Array<{ span: Span; clip: StudioClip; rects: NonNullable<ReturnType<typeof pictureRects>>; trackIndex: number }> = [];
  visual.forEach((clips, trackIndex) => {
    for (const clip of clips) {
      if (clip.kind !== 'video' || clip.assetId !== refAsset.id) continue;
      const from = Math.max(0, clip.timelineStart);
      const to = Math.min(durationSec, end(clip));
      if (to <= from) continue;
      const skip = (reason: string) => skipped.push({ from: ms(from), to: ms(to), reason });
      const speed = clip.speed ?? 1;
      const opacity = clip.transform?.opacity ?? 1;
      const rects = pictureRects(comp, output, media, clip.transform);
      if (speed !== 1) skip(`camera clip at speed ×${speed}`);
      else if (clip.transform?.rotation) skip('camera picture rotated');
      else if (opacity < 1) skip(`camera picture faded (opacity ${opacity})`);
      else if (!rects || rects.exportRect.width < MIN_SIDE_PX || rects.exportRect.height < MIN_SIDE_PX) skip('camera picture too small or off the frame');
      else if (to - edge - windowSec <= from + edge) skip(`camera clip shorter than the ${windowSec} s audio window`);
      else {
        let spans: Span[] = [[from + edge, to - edge - windowSec]];
        for (let above = 0; above < trackIndex; above++) {
          for (const cover of visual[above]) {
            const cFrom = Math.max(from, cover.timelineStart);
            const cTo = Math.min(to, end(cover));
            if (cTo <= cFrom) continue;
            let reason: string | null = null;
            if (cover.kind === 'tsx' && cover.tsx?.mode !== 'overlay') reason = `under the cutaway shot "${cover.tsx?.shotId ?? cover.id}"`;
            else if (cover.kind === 'video' || cover.kind === 'image') {
              const box = pictureBox(comp, output, mediaSize(cover.assetId ? assets.get(cover.assetId) : undefined, comp), cover.transform);
              if (intersects(box, rects.exportRect)) reason = `under the ${cover.kind} clip "${cover.id}"`;
            }
            if (!reason) continue;
            skipped.push({ from: ms(cFrom), to: ms(cTo), reason });
            spans = subtract(spans, [cFrom, cTo]);
          }
        }
        for (const span of spans) if (span[1] > span[0]) free.push({ span, clip, rects, trackIndex });
      }
    }
  });
  skipped.sort((a, b) => a.from - b.from);

  const visibleSec = free.reduce((sum, f) => sum + (f.span[1] - f.span[0]), 0);
  const probes: SyncProbe[] = [];
  const seen = new Set<number>();
  for (let k = 0; k < count && visibleSec > 0; k++) {
    let pos = ((k + 0.5) * visibleSec) / count;
    const slot = free.find((f) => {
      const len = f.span[1] - f.span[0];
      if (pos <= len) return true;
      pos -= len;
      return false;
    }) ?? free[free.length - 1];
    const raw = slot.span[0] + pos;
    let frame = Math.round(raw * fps);
    if (frame / fps < slot.span[0]) frame = Math.ceil(slot.span[0] * fps);
    if (frame / fps > slot.span[1]) frame = Math.floor(slot.span[1] * fps);
    if (seen.has(frame)) continue;
    seen.add(frame);
    const t = frame / fps;
    const overlays = visual
      .slice(0, slot.trackIndex)
      .flat()
      .filter((c) => c.kind === 'tsx' && c.tsx?.mode === 'overlay' && c.timelineStart <= t && t < end(c))
      .map((c) => c.tsx?.shotId ?? c.id);
    probes.push({
      t,
      frame,
      clipId: slot.clip.id,
      sourceSec: (slot.clip.sourceIn ?? 0) + (t - slot.clip.timelineStart),
      exportRect: slot.rects.exportRect,
      sourceRect: slot.rects.sourceRect,
      overlays,
    });
  }
  return { reference, probes, skipped, visibleSec };
}
