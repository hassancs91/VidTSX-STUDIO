// Timeline document (seconds) → Remotion composition input (frames + URLs).
//
// The same serializer feeds the editor's <Player> and the export render; only
// the URL resolver differs (720p proxies for preview, originals for export),
// which is what makes "what you scrub is what renders" true.

import type {
  ShotRuntimeProps,
  StudioClip,
  StudioClipKind,
  StudioClipTransform,
  StudioProject,
  StudioTrackKind,
  StudioTransitionKind,
} from '../types/studio';
import type { StudioBrand } from '../types/asset-library';
import { clipEnd, spanToFrames, timeToFrame, timelineDurationInFrames } from './time-math';
import { deriveCaptionGroups, type CaptionWordSource } from './caption-words';
import { resolveCaptionPalette, resolvedStyle } from './caption-layer';

/** A ramp window at one edge of a serialized clip (Slice E transitions). */
export interface SerializedTransition {
  kind: StudioTransitionKind;
  /** Window length in composition frames, measured from the clip's own edge. */
  frames: number;
}

export interface SerializedClip {
  id: string;
  kind: StudioClipKind;
  /** Absolute frame on the timeline where the clip starts. */
  from: number;
  durationInFrames: number;
  /** Frames into the source media (Remotion's `trimBefore`). For tsx clips it
   *  is a plain frame offset the composition applies itself — and it may be
   *  NEGATIVE: a crossfade-in extends the clip's head, and the shot's frame 0
   *  must stay put at the original boundary or baked word timings shift. */
  trimBefore?: number;
  /** Resolved http URL of the media, or null when the asset is missing. */
  src?: string;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  /** Audio fade ramp lengths in composition frames (Slice C1). */
  fadeInFrames?: number;
  fadeOutFrames?: number;
  /** Transition ramps (Slice E). `from`/`durationInFrames`/`trimBefore`
   *  already include any crossfade extension — the composition only ramps. */
  transitionIn?: SerializedTransition;
  transitionOut?: SerializedTransition;
  transform?: StudioClipTransform;
  /** TSX shot reference (S4) — the composition looks the component up in its
   *  parallel `components` map by shotId. `props` is the D12 runtime-props
   *  channel: asset refs resolved to per-environment URLs (and, later,
   *  whatever else the serializer derives for the component). */
  tsx?: { shotId: string; mode: 'cutaway' | 'overlay'; props?: ShotRuntimeProps };
}

export interface SerializedTrack {
  id: string;
  kind: StudioTrackKind;
  clips: SerializedClip[];
}

export interface SerializedTimeline {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** UI order, top lane first. Painting is reverse order — see TimelineComposition. */
  tracks: SerializedTrack[];
}

/** Maps an assetId to a URL the Player/renderer can fetch, or null if missing. */
export type AssetUrlResolver = (assetId: string) => string | null;

/** The id the synthetic caption track and its clip carry. Stable so the
 *  Player's Sequence identity survives re-serialization. */
export const CAPTION_TRACK_ID = 'captions';

/**
 * What the serializer needs to derive captions (D13). The CALLER supplies the
 * words — the renderer reads the transcript cache over IPC, the export entry
 * reads it from disk — so this function stays pure and synchronous.
 */
export interface CaptionSerializeContext {
  /** Word transcripts by asset id; an absent asset contributes nothing. */
  words: CaptionWordSource;
  /** The project's active brand, for a layer styled with 'brand' colors. A
   *  stale brandId simply arrives as null and the built-in palette is used. */
  brand?: Pick<StudioBrand, 'palette' | 'fonts'> | null;
}

/** Geometry a transition adds to the two clips at a boundary. */
interface BoundaryAdjustment {
  kind: StudioTransitionKind;
  /** Crossfade: frames the leading clip extends past the cut. */
  extLeadFrames: number;
  /** Crossfade: frames the trailing clip starts before the cut. */
  extTrailFrames: number;
  /** Ramp window on the leading clip's tail. */
  outFrames: number;
  /** Ramp window on the trailing clip's head. */
  inFrames: number;
}

/** Kinds whose handles are a real media file (extension consumes source). */
const MEDIA_KINDS: ReadonlySet<StudioClipKind> = new Set(['video', 'audio', 'sfx']);

/**
 * Every kind but dip-to-black needs both clips live across the window — the
 * crossfade, and every pack transition (`<pack>/<item>`, whose component is
 * handed both pictures; docs/studio/TRANSITION_PACKS_DESIGN.md). They borrow
 * source material beyond the cut ("handles"), so each side
 * clamps to what the media can actually supply — exactly like every NLE. The
 * leading clip needs source after its out point; the trailing clip needs
 * source before its in point (its `trimBefore`). `playbackRate` scales how
 * fast extension frames consume source. Images/tsx have unlimited handles.
 */
function computeAdjustment(
  lead: StudioClip,
  trail: StudioClip,
  fps: number,
  sourceDurationOf: (assetId: string) => number | undefined,
): BoundaryAdjustment | null {
  const transition = lead.transitionOut;
  if (!transition) return null;
  const cut = clipEnd(lead);
  const half = transition.duration / 2;

  if (transition.kind === 'dip-to-black') {
    // No extension: the leading clip ramps out over its own last half-window,
    // the trailing one ramps in over its first — re-clamped after quantization.
    const outFrames = Math.min(
      timeToFrame(cut, fps) - timeToFrame(cut - half, fps),
      spanToFrames(lead.timelineStart, cut, fps),
    );
    const inFrames = Math.min(
      timeToFrame(cut + half, fps) - timeToFrame(cut, fps),
      spanToFrames(trail.timelineStart, clipEnd(trail), fps),
    );
    if (outFrames <= 0 && inFrames <= 0) return null;
    return { kind: transition.kind, extLeadFrames: 0, extTrailFrames: 0, outFrames, inFrames };
  }

  const leadRate = lead.speed ?? 1;
  const trailRate = trail.speed ?? 1;
  let maxLead = Number.POSITIVE_INFINITY;
  if (MEDIA_KINDS.has(lead.kind)) {
    const sourceDuration = lead.assetId ? sourceDurationOf(lead.assetId) : undefined;
    if (sourceDuration === undefined) return null;
    const availSourceSec = sourceDuration - ((lead.sourceIn ?? 0) + lead.duration * leadRate);
    maxLead = Math.max(0, Math.floor((availSourceSec / leadRate) * fps));
  }
  let maxTrail = Number.POSITIVE_INFINITY;
  if (MEDIA_KINDS.has(trail.kind)) {
    // newTrimBefore = trimBefore − ext × rate must stay ≥ 0.
    maxTrail = Math.max(0, Math.floor(timeToFrame(trail.sourceIn ?? 0, fps) / trailRate));
  }

  const extLeadFrames = Math.min(timeToFrame(cut + half, fps) - timeToFrame(cut, fps), maxLead);
  const extTrailFrames = Math.min(
    timeToFrame(cut, fps) - timeToFrame(cut - half, fps),
    maxTrail,
  );
  const overlap = extLeadFrames + extTrailFrames;
  if (overlap <= 0) return null; // no handles at all — renders as a hard cut
  return {
    kind: transition.kind,
    extLeadFrames,
    extTrailFrames,
    outFrames: overlap,
    inFrames: overlap,
  };
}

/**
 * Frames the transition on `lead`'s out-boundary actually spans once handles
 * are clamped — the overlap for a crossfade or pack transition, both ramps for
 * a dip. 0 = it serializes to a hard cut (neither clip has media past the
 * cut). The editor's join warnings ask here, so they can never disagree with
 * what renders.
 */
export function transitionSpanFrames(
  lead: StudioClip,
  trail: StudioClip,
  fps: number,
  sourceDurationOf: (assetId: string) => number | undefined,
): number {
  const adj = computeAdjustment(lead, trail, fps, sourceDurationOf);
  if (!adj) return 0;
  return adj.kind === 'dip-to-black' ? adj.outFrames + adj.inFrames : adj.outFrames;
}

/**
 * The caption layer as a serialized top overlay (D13 §C3): ONE clip spanning
 * the composition, carrying the derived word stream through the SAME
 * `tsx.props` channel D12 built for shot assets. `shotId` holds the namespaced
 * templateId — the consumer supplies the component, exactly like shots.
 *
 * Returns null when there are no captions to paint (absent/disabled layer, or
 * a master lane with no transcribed words yet), so the composition never
 * mounts an empty overlay.
 */
function serializeCaptions(
  project: StudioProject,
  durationInFrames: number,
  context: CaptionSerializeContext,
): SerializedTrack | null {
  const layer = project.captions;
  if (!layer || !layer.enabled || durationInFrames <= 0) return null;
  const groups = deriveCaptionGroups(project.timeline, context.words, layer.style.wordsPerGroup);
  if (groups.length === 0) return null;
  return {
    id: CAPTION_TRACK_ID,
    kind: 'caption',
    clips: [
      {
        id: CAPTION_TRACK_ID,
        kind: 'caption',
        from: 0,
        durationInFrames,
        tsx: {
          shotId: layer.templateId,
          mode: 'overlay',
          props: {
            captions: {
              groups,
              style: resolvedStyle(layer.style),
              palette: resolveCaptionPalette(layer.style.colors, context.brand),
            },
          },
        },
      },
    ],
  };
}

export function serializeTimeline(
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
  /** Captions (D13). Omitted = no caption layer is emitted, which is what
   *  every non-caption caller (and every pre-D13 test) wants. */
  captions?: CaptionSerializeContext,
): SerializedTimeline {
  const { fps, width, height } = project.settings;
  const sourceDurationOf = (assetId: string) =>
    project.assets.find((a) => a.id === assetId)?.probe.duration;

  const tracks: SerializedTrack[] = [];
  for (const track of project.timeline.tracks) {
    // A hidden track drops its picture; audio-only tracks have nothing to hide.
    if (track.hidden && track.kind !== 'audio') continue;

    // Transition geometry per boundary, keyed by the clips it touches. Clips
    // are sorted and non-overlapping (timeline-ops invariant). The reducer
    // prunes non-contiguous transitions, but a loaded document never passed
    // through the reducer — so contiguity is re-checked here, not trusted.
    const outAdj = new Map<string, BoundaryAdjustment>();
    const inAdj = new Map<string, BoundaryAdjustment>();
    for (let i = 0; i < track.clips.length - 1; i++) {
      const lead = track.clips[i];
      const trail = track.clips[i + 1];
      if (!lead.transitionOut) continue;
      if (Math.abs(trail.timelineStart - clipEnd(lead)) > 1e-6) continue;
      const adj = computeAdjustment(lead, trail, fps, sourceDurationOf);
      if (!adj) continue;
      outAdj.set(lead.id, adj);
      inAdj.set(trail.id, adj);
    }

    const clips: SerializedClip[] = [];
    for (const clip of track.clips) {
      let durationInFrames = spanToFrames(
        clip.timelineStart,
        clip.timelineStart + clip.duration,
        fps,
      );
      if (durationInFrames <= 0) continue;

      const src = clip.assetId ? resolveUrl(clip.assetId) : null;
      // Media clips with no resolvable source would render a Remotion error
      // overlay mid-timeline; skipping keeps the rest of the edit playable.
      if (!src && clip.kind !== 'tsx' && clip.kind !== 'caption') continue;

      // Same drop rule for tsx clips whose shot the document can't resolve to
      // renderable code (missing from the registry, still generating, error).
      let tsxProps: ShotRuntimeProps | undefined;
      if (clip.kind === 'tsx') {
        const shot = clip.tsx
          ? project.shots.find((s) => s.id === clip.tsx?.shotId)
          : undefined;
        if (!shot || shot.status !== 'ready') continue;

        // Asset refs resolve through the same resolver as clip src, so the
        // preview/export URL asymmetry stays this function's problem (D12).
        // An unresolvable ref drops the clip — the media missing-src rule;
        // rendering the shot with a broken <Img> would error mid-timeline.
        if (shot.assetRefs && Object.keys(shot.assetRefs).length > 0) {
          const assets: Record<string, string> = {};
          let missing = false;
          for (const [key, assetId] of Object.entries(shot.assetRefs)) {
            const url = resolveUrl(assetId);
            if (!url) {
              missing = true;
              break;
            }
            assets[key] = url;
          }
          if (missing) continue;
          tsxProps = { assets };
        }
      }

      let from = timeToFrame(clip.timelineStart, fps);
      let trimBefore = clip.sourceIn ? timeToFrame(clip.sourceIn, fps) : undefined;
      const rate = clip.speed ?? 1;

      const out = outAdj.get(clip.id);
      if (out) durationInFrames += out.extLeadFrames;
      const into = inAdj.get(clip.id);
      if (into && into.extTrailFrames > 0) {
        from -= into.extTrailFrames;
        durationInFrames += into.extTrailFrames;
        // Media can't rewind before source frame 0, so the shift clamps — the
        // handle math already capped the extension to what trimBefore allows.
        // A tsx clip has no such floor: its offset must go negative so the
        // shot's internal clock stays anchored to the original clip start
        // (baked word timings would otherwise fire early by the extension).
        const shifted = Math.round((trimBefore ?? 0) - into.extTrailFrames * rate);
        trimBefore = clip.kind === 'tsx' ? shifted : Math.max(0, shifted);
      }

      // Fades are durations, not positions — plain rounding, clamped so the
      // ramps never overlap even after frame quantization.
      const fadeInFrames = Math.min(Math.round((clip.fadeInSec ?? 0) * fps), durationInFrames);
      const fadeOutFrames = Math.min(
        Math.round((clip.fadeOutSec ?? 0) * fps),
        durationInFrames - fadeInFrames,
      );

      clips.push({
        id: clip.id,
        kind: clip.kind,
        from,
        durationInFrames,
        ...(trimBefore ? { trimBefore } : {}),
        ...(src ? { src } : {}),
        ...(clip.gain !== undefined ? { volume: clip.gain } : {}),
        ...(track.muted ? { muted: true } : {}),
        ...(clip.speed !== undefined && clip.speed !== 1 ? { playbackRate: clip.speed } : {}),
        ...(fadeInFrames > 0 ? { fadeInFrames } : {}),
        ...(fadeOutFrames > 0 ? { fadeOutFrames } : {}),
        ...(out ? { transitionOut: { kind: out.kind, frames: out.outFrames } } : {}),
        ...(into ? { transitionIn: { kind: into.kind, frames: into.inFrames } } : {}),
        ...(clip.transform ? { transform: clip.transform } : {}),
        ...(clip.kind === 'tsx' && clip.tsx
          ? {
              tsx: {
                shotId: clip.tsx.shotId,
                mode: clip.tsx.mode,
                ...(tsxProps ? { props: tsxProps } : {}),
              },
            }
          : {}),
      });
    }
    tracks.push({ id: track.id, kind: track.kind, clips });
  }

  const durationInFrames = timelineDurationInFrames(project.timeline, fps);

  // Captions paint over everything: tracks are in UI order and the composition
  // paints in reverse, so the caption lane goes FIRST.
  const captionTrack = captions ? serializeCaptions(project, durationInFrames, captions) : null;

  return {
    width,
    height,
    fps,
    durationInFrames,
    tracks: captionTrack ? [captionTrack, ...tracks] : tracks,
  };
}
