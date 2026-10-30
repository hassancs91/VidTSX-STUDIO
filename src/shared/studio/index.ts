export { TimelineComposition } from './TimelineComposition';
// The export entry builds the render host's mask readers (export-tracks.ts).
export { createMaskReader, httpRangeFetcher } from './mask-reader';
export type { TimelineCompositionProps } from './TimelineComposition';
export { CAPTION_TRACK_ID, serializeTimeline } from './serialize';
export type {
  AssetUrlResolver,
  CaptionSerializeContext,
  SerializedClip,
  SerializedTimeline,
  SerializedTrack,
} from './serialize';
export {
  CAPTION_SCALE_MAX,
  CAPTION_SCALE_MIN,
  DEFAULT_CAPTION_STYLE,
  FALLBACK_CAPTION_PALETTE,
  normalizeCaptionLayer,
  normalizeCaptionStyle,
  resolveCaptionPalette,
  resolvedStyle,
} from './caption-layer';
export {
  deriveCaptionGroups,
  deriveCaptionSegments,
  groupCaptionWords,
  masterLane,
  untranscribedMasterClips,
} from './caption-words';
export type { CaptionWordSource, SourceWord } from './caption-words';
export {
  formatTimelineTc,
  isThroughEdit,
  JOIN_EPS,
  masterTimelineModel,
  summarizeMasterCuts,
  timelineLength,
} from './timeline-cuts';
export type { MasterCut, MasterCutsSummary, MasterGap, MasterJoin, MasterTimelineModel } from './timeline-cuts';
export { mapSourceSpanToTimeline } from './source-span-map';
export type { SourceSpan, SourceSpanRegion } from './source-span-map';
export { aspectOf, parseTemplateId } from './caption-pack';
export type { CaptionAspect, CaptionTemplate, CaptionTemplateDefaults } from './caption-pack';
export {
  clipEnd,
  frameToTime,
  spanToFrames,
  timelineDuration,
  timelineDurationInFrames,
  timeToFrame,
} from './time-math';
export { rangeDurationInFrames, trimTimelineToRange } from './trim-range';
export { RmsEnvelope } from './cut-planner';
export type { PlanSpan, PlanWord } from './cut-planner';
export { snapCutSpans } from './cut-snap';
export { withEdgeTag, withoutEdgeTag } from './clip-edge-tags';
export type { ClipEdge } from './clip-edge-tags';
export type { CutSpanInput, SnapCutSpansInput, SnapCutSpansResult, SnappedCut } from './cut-snap';
export { TAKE_GAP_SECONDS, isFillerWord } from './transcript-tokens';
export { isValidShotId, normalizeShots } from './shots';
