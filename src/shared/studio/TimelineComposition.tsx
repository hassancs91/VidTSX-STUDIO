import { Fragment, useMemo } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useRemotionEnvironment } from 'remotion';
import type { CaptionRuntimeProps, FilterDefinition, ShotRuntimeProps, TransitionRuntimeProps } from '../types/studio';
import { ClipRenderer } from './ClipRenderer';
import type { AnalysisTracks } from './face-track';
import { SceneSourceContext, useSceneSources } from './SceneMirror';
import type { SerializedClip, SerializedTimeline } from './serialize';
import { TransitionWindow } from './TransitionWindow';
import { coverByClip, planTransitionWindows, type ClipCover, type TransitionWindowPlan } from './transition-windows';

export interface TimelineCompositionProps {
  timeline: SerializedTimeline;
  /**
   * The caption template component (D13). Supplied the same way shot
   * components are — a component can't ride serialized data — while its PROPS
   * ride `clip.tsx.props.captions` like every other runtime prop. Absent (or
   * an uninstalled pack) simply paints no captions: a missing template must
   * never hard-fail a project (PACKS_DESIGN.md graceful degrade).
   */
  captionComponent?: React.ComponentType<CaptionRuntimeProps>;
  /**
   * TSX shot components keyed by shotId (S4). Components can't ride
   * `inputProps`, so each consumer supplies its own map over the same
   * serialized timeline: the preview passes live-imported ESM modules (each
   * wrapped in an error boundary by the supplier), the export entry will pass
   * static imports. A missing entry renders nothing — the supplier
   * substitutes a placeholder component when it wants one, so this
   * composition stays dumb. Each component receives the clip's serialized
   * `tsx.props` (resolved asset URLs, D12).
   */
  components?: Record<string, React.ComponentType<ShotRuntimeProps>>;
  /**
   * Pack transition components keyed by their namespaced id (`core/push-left`),
   * supplied exactly like `components`. A boundary whose id has no entry here —
   * pack not installed, module failed to load — renders as a crossfade: the
   * overlap and its ramps are already on the clips
   * (docs/studio/TRANSITION_PACKS_DESIGN.md).
   */
  transitionComponents?: Record<string, React.ComponentType<TransitionRuntimeProps>>;
  /**
   * Pack filters keyed by their namespaced id (`core/noir`), supplied like
   * `transitionComponents` (docs/studio/FILTER_PACKS_DESIGN.md): the preview
   * loads the kinds its timeline references, the export entry passes static
   * imports. A clip whose entry has no definition here shows its plain
   * picture. Undefined = today's path, untouched.
   */
  filterDefinitions?: Readonly<Record<string, FilterDefinition>>;
  /**
   * Analysis tracks keyed by ASSET id (docs/studio/FILTER_PACKS_DESIGN.md
   * "Analysis tracks"): the faces a tracked filter consumes per frame, by
   * source seconds. The preview passes the tracks it read from the cache,
   * the export entry a static import of the same files. A filtered clip
   * whose asset has no track here plays the plain picture (the SDK's rule
   * for `faces: []`).
   */
  tracks?: Readonly<Record<string, AnalysisTracks>>;
  /**
   * Engine 3 (docs/export-engines-plan.md "shot composite"): render only the
   * SHOT LAYER — the overlay and caption lanes' graphics (tsx, caption, image
   * clips) over a transparent background — so ffmpeg can composite it onto
   * footage copied straight from the source files. Footage and sound never
   * mount here. Absent = the whole timeline, exactly as before.
   */
  layer?: 'shots';
}

/**
 * How far outside the current frame a clip still gets mounted.
 *
 * A <Sequence> outside its window renders nothing, so mounting all of them is
 * pure cost — on a 100-cut timeline that was ~100 component renders per frame
 * change, and it showed up as sluggish scrubbing. The margin bounds how many
 * Sequences exist at once; `premountFor` (same window) is what makes the
 * early mount useful: it renders the upcoming clip hidden and frozen on its
 * first frame, so the media element is created and seeked BEFORE the cut —
 * without it, every join flashes black for the length of a video seek.
 * Premounting is a Player-side aid; renders wait per-frame and are unaffected.
 */
const MOUNT_WINDOW_SECONDS = 2;

/** What one track adds to the picture beyond its clips: pack-transition windows. */
interface TrackTransitions {
  windows: TransitionWindowPlan[];
  covers: Map<string, ClipCover>;
  clipsById: Map<string, SerializedClip>;
}

/**
 * The data-driven composition behind both the editor preview (@remotion/player
 * over 720p proxies) and the final render (renderMedia over originals) — the
 * "what you scrub is what renders" guarantee from docs/studio/PLAN.md §5.
 *
 * Layering: `tracks` is in UI order (top lane first), so painting runs in
 * reverse — the last array entry goes down first and the top lane lands on
 * top, matching how the timeline panel reads. A track's transition windows
 * paint after its clips: over their (hidden) pictures, under every lane above.
 */
export function TimelineComposition({
  timeline,
  components,
  captionComponent,
  transitionComponents,
  filterDefinitions,
  tracks: analysisTracks,
  layer,
}: TimelineCompositionProps) {
  const frame = useCurrentFrame();
  const tracks = useMemo(
    () => (layer === 'shots' ? shotLayerTracks(timeline.tracks) : timeline.tracks),
    [timeline.tracks, layer],
  );
  const painted = [...tracks].reverse();
  const margin = timeline.fps * MOUNT_WINDOW_SECONDS;
  const isNearby = (from: number, durationInFrames: number) =>
    from - margin <= frame && frame < from + durationInFrames + margin;

  // Planned over the tracks as painted: in the shot layer a window needs both
  // of its clips to have survived the filter, and the planner's own geometry
  // check refuses a pair the filter merely made adjacent.
  const transitions = useMemo(() => {
    const byTrack = new Map<string, TrackTransitions>();
    if (!transitionComponents) return byTrack;
    for (const track of tracks) {
      const windows = planTransitionWindows(track.clips, (kind) => kind in transitionComponents);
      if (windows.length === 0) continue;
      byTrack.set(track.id, {
        windows,
        covers: coverByClip(windows),
        clipsById: new Map(track.clips.map((c) => [c.id, c])),
      });
    }
    return byTrack;
  }, [tracks, transitionComponents]);

  // Player only: window scene copies mirror their clip's element instead of
  // mounting more decoders (SceneMirror.tsx). A render keeps Structure A.
  const { isPlayer, isRendering } = useRemotionEnvironment();
  const sceneSources = useSceneSources();
  const mirrorScenes = isPlayer && !isRendering && transitions.size > 0;

  return (
    <SceneSourceContext.Provider value={mirrorScenes ? sceneSources : null}>
      <AbsoluteFill style={{ backgroundColor: layer === 'shots' ? 'transparent' : 'black' }}>
        {painted.map((track) => {
          const trackTransitions = transitions.get(track.id);
          return (
            <Fragment key={track.id}>
              {track.clips
                .filter((clip) => isNearby(clip.from, clip.durationInFrames))
                .map((clip) => (
                  <Sequence
                    key={clip.id}
                    from={clip.from}
                    durationInFrames={clip.durationInFrames}
                    premountFor={margin}
                    layout={clip.kind === 'audio' || clip.kind === 'sfx' ? 'none' : 'absolute-fill'}
                    name={clip.id}
                  >
                    <ClipRenderer
                      clip={clip}
                      components={components}
                      captionComponent={captionComponent}
                      filterDefinitions={filterDefinitions}
                      tracks={analysisTracks}
                      cover={trackTransitions?.covers.get(clip.id)}
                    />
                  </Sequence>
                ))}
              {trackTransitions?.windows
                .filter((win) => isNearby(win.from, win.frames))
                .map((win) => {
                  const lead = trackTransitions.clipsById.get(win.leadId);
                  const trail = trackTransitions.clipsById.get(win.trailId);
                  const component = transitionComponents?.[win.kind];
                  if (!lead || !trail || !component) return null;
                  return (
                    <TransitionWindow
                      key={`transition:${win.id}`}
                      plan={win}
                      lead={lead}
                      trail={trail}
                      component={component}
                      width={timeline.width}
                      height={timeline.height}
                      premountFor={margin}
                      components={components}
                      captionComponent={captionComponent}
                      filterDefinitions={filterDefinitions}
                      tracks={analysisTracks}
                    />
                  );
                })}
            </Fragment>
          );
        })}
      </AbsoluteFill>
    </SceneSourceContext.Provider>
  );
}

/**
 * The shot layer's tracks: the overlay and caption lanes with only their
 * graphics (the same kinds `isLayerClipKind` in export-spans.ts names), in
 * the same order, so stacking and every clip's own transform, trim offset
 * and props render exactly as in the whole composition.
 */
function shotLayerTracks(tracks: SerializedTimeline['tracks']): SerializedTimeline['tracks'] {
  return tracks
    .filter((t) => t.kind === 'overlay' || t.kind === 'caption')
    .map((t) => ({ ...t, clips: t.clips.filter((c) => c.kind === 'tsx' || c.kind === 'caption' || c.kind === 'image') }));
}
