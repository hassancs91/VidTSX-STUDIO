export { TimelineComposition } from './TimelineComposition';
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
export { isValidShotId, normalizeShots } from './shots';
