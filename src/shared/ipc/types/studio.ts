import type { TranscriptSegment } from './whisper';
import type { TsxSuggestion, TsxSlot } from './tsx';
import type { RenderCodec, RenderGpuBackend, RenderHardwareAcceleration } from './render';

// ─── Studio project types ───
export interface VideoMetadata {
  durationInSeconds: number;
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  fileSize: number;
  fileName: string;
  filePath: string;
}

// Canvas the project renders onto. Independent of any attached video.
export interface StudioComposition {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  durationInSeconds: number;
}

// Free-transform applied to a canvas layer (video clip or TSX overlay).
// Coordinates are in COMPOSITION pixels. The layer is authored at full
// composition size and uniformly scaled into this box (After Effects-style
// transform), so inner layout, fonts, and strokes scale together. Rotation is
// applied about the box center. Undefined on a clip/slot = full-frame (the
// original, pre-transform behavior), so existing projects render unchanged.
export interface LayerTransform {
  x: number; // box top-left X in composition px
  y: number; // box top-left Y in composition px
  width: number; // box width in composition px
  height: number; // box height in composition px
  rotation?: number; // degrees clockwise about the box center
}

export const DEFAULT_STUDIO_COMPOSITION: StudioComposition = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 900,
  durationInSeconds: 30,
};

export interface StudioFfprobeRequest {
  filePath: string;
}

export interface StudioFfprobeResponse {
  success: boolean;
  metadata?: VideoMetadata;
  error?: string;
}

export interface StudioProjectCaptions {
  segments: TranscriptSegment[];
  styleId: string;
  // Base settings shared by every style (position, fontSize). Kept under the
  // existing `settings` field name for backward-compat with older projects.
  settings: { position: { x: number; y: number }; fontSize: number };
  // Per-style config blobs keyed by styleId. Opaque to storage — each style's
  // definition declares its shape and provides defaults; the resolver merges
  // stored values over defaults at render time. Optional so older projects
  // load with empty configs and each style uses its defaults.
  styleConfigs?: Record<string, unknown>;
  // When true, segment start/end are TIMELINE (cut) times and the captions are
  // free-floating overlays — positioned independently of the video, not remapped
  // from source-time. Set once the project's captions have been "baked" to
  // cut-time. Undefined/false = legacy source-time captions (remapped onto the
  // video clips for display until baked).
  freeform?: boolean;
}

export type StudioImportKind = 'video' | 'image' | 'audio';

export interface StudioImport {
  id: string;
  kind: StudioImportKind;
  filePath: string;
  fileName: string;
  addedAt: number;
  // Low-res edit copy ("proxy") for smooth preview playback of large videos.
  // Generated on demand; absent until the user requests it. The preview swaps
  // this in for clips referencing this import; export always uses `filePath`.
  // Only meaningful for `kind: 'video'`. May point at a since-deleted file — the
  // generator re-creates it on demand.
  proxyPath?: string;
}

// ─── Studio video proxy (low-res edit copy) ───
// On-demand ffmpeg transcode of a source video to a small, fast-decoding mp4.
// Aspect ratio is preserved (scaled by height); export is unaffected.

export interface StudioProxyGenerateRequest {
  projectId: string;
  importId: string;
  filePath: string;
  // Force a re-encode even if a cached proxy already exists.
  force?: boolean;
}

export interface StudioProxyGenerateResponse {
  success: boolean;
  proxyPath?: string;
  // True when an existing proxy was reused (no transcode performed).
  cached?: boolean;
  cancelled?: boolean;
  error?: string;
}

export interface StudioProxyCancelRequest {
  projectId: string;
  importId: string;
}

export interface StudioProxyCancelResponse {
  success: boolean;
}

// On project load, confirm persisted proxies still exist on disk. Import ids
// whose proxy file is gone are dropped from `present`, so the renderer can clear
// their stale `proxyPath` and fall back to the original (no black preview).
export interface StudioProxyVerifyRequest {
  projectId: string;
  importIds: string[];
}

export interface StudioProxyVerifyResponse {
  success: boolean;
  // Subset of the requested ids whose proxy file currently exists.
  present?: string[];
  error?: string;
}

// Push event (webContents.send) — percent is 0..100.
export interface StudioProxyProgress {
  projectId: string;
  importId: string;
  percent: number;
}

export type StudioCutReason = 'retake' | 'silence' | 'repeat' | 'manual';

// ─── Clip effects ───
// Per-clip visual effects applied on top of a video clip. They render via CSS
// (opacity / transform / filter) computed from the clip-local frame, so the
// live Player and the headless export produce identical output (the same
// StudioComposition drives both). v1 ships five foundational effects and is
// wired only on the Video track; image/text/TSX tracks can adopt this later.
export type StudioEffectType = 'fade' | 'zoom' | 'blur' | 'grayscale' | 'shake';

// Fade the clip in/out at its edges (opacity ramp). Durations are clip-relative
// seconds; 0 disables that side. Stored in seconds (not frames) so they survive
// an fps change unscaled.
export interface StudioFadeEffect {
  type: 'fade';
  inSeconds: number;
  outSeconds: number;
}

// Ken Burns zoom: scale ramps linearly from `from` to `to` over the clip.
// 1 = no zoom; >1 zooms in, <1 zooms out.
export interface StudioZoomEffect {
  type: 'zoom';
  from: number;
  to: number;
}

// Gaussian blur, constant over the clip. `amount` is the blur radius in px.
export interface StudioBlurEffect {
  type: 'blur';
  amount: number;
}

// Desaturate toward black & white. `amount` 0..1 (1 = fully grayscale).
export interface StudioGrayscaleEffect {
  type: 'grayscale';
  amount: number;
}

// Camera shake: oscillating translate. `intensity` is the px amplitude,
// `speed` a relative multiplier on the oscillation frequency.
export interface StudioShakeEffect {
  type: 'shake';
  intensity: number;
  speed: number;
}

export type StudioEffect =
  | StudioFadeEffect
  | StudioZoomEffect
  | StudioBlurEffect
  | StudioGrayscaleEffect
  | StudioShakeEffect;

// ─── Video transitions ───
// Entrance/exit transitions attached to a clip's edges. Unlike effects (which
// animate a single clip in isolation), a transition blends a clip against what
// sits next to it on the Video track:
//   • transitionIn  — plays as the clip ENTERS. Over the previous contiguous
//                     clip (a cut "between two videos") or, for the first clip,
//                     over the background ("video start").
//   • transitionOut — plays as the clip LEAVES, over its last frames in place
//                     ("video end").
// The five foundational types are pure opacity/transform/clip-path effects, so
// they render deterministically in both the live <Player> and headless export
// (the same StudioComposition drives both). v1 is Video-track only.
export type StudioTransitionType = 'fade' | 'slide' | 'wipe' | 'zoom' | 'flip';

// Duration is stored in seconds (matching clip start/end times) so it survives
// an export-fps change unscaled; the composition converts it to frames.
export interface StudioClipTransition {
  type: StudioTransitionType;
  durationInSeconds: number;
}

// ─── Object animations (Camtasia-style arrows) ───
// An animation is a span ("arrow") placed on a visual object (video / image /
// text). Over the span the object TWEENS its visual state from `from` to `to`.
// Both endpoints are expressed RELATIVE to the object's resting transform
// (identity = the object as it sits with no animation). At any clip-local frame
// the object's state is a pure fold over its arrows (sorted by start):
//   • inside an arrow  → lerp(from, to, ease(progress))
//   • after an arrow   → hold its `to` (no snap-back)
//   • before the first → hold its `from` (an entrance stays off until it plays)
//   • otherwise        → resting (identity)
// Arrows on one clip are kept non-overlapping, so the fold is unambiguous.
// Presets just prefill the `from`/`to` pair; preset or not, every animation is
// the same span+tween. Renders identically in the live <Player> and the
// headless export (the same StudioComposition drives both). v1 spans video,
// image, and text tracks.

// One end of an arrow. All fields optional; an absent field = resting for that
// property. Offsets are in COMPOSITION px, relative to the resting position.
export interface StudioAnimationState {
  scale?: number; // 1 = resting
  offsetX?: number; // composition px, relative to resting position
  offsetY?: number;
  rotation?: number; // degrees, relative to resting rotation
  opacity?: number; // 0..1
}

export type StudioAnimationPreset =
  | 'fadeIn'
  | 'fadeOut'
  | 'popIn'
  | 'slideIn'
  | 'slideOut'
  | 'zoom'
  | 'spinIn'
  | 'tilt'
  // Phase 3 additions:
  | 'fly' // slide without the fade
  | 'bounceIn' // scale up with an overshoot
  | 'zoomOut' // starts scaled up, settles to resting
  | 'spinOut' // spins away while fading out
  | 'pan' // slow positional drift (emphasis)
  | 'grow' // gentle scale-up & hold (emphasis)
  | 'custom'; // user-defined: end (and start) pose set by dragging on the canvas

export type StudioAnimationEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutBack'; // overshoots past the target then settles (bounce feel)

// Start/duration are CLIP-RELATIVE seconds (fps-safe, matching transitions), so
// they survive an export-fps change unscaled; the composition converts to frames.
export interface StudioClipAnimation {
  id: string;
  preset: StudioAnimationPreset;
  startSeconds: number;
  durationSeconds: number;
  from: StudioAnimationState;
  to: StudioAnimationState;
  // Directional presets (slide) only — chooses which way the offset points.
  direction?: 'up' | 'down' | 'left' | 'right';
  easing?: StudioAnimationEasing;
}

export interface StudioVideoClip {
  id: string;
  importId?: string;
  filePath: string;
  fileName: string;
  startTime: number;
  endTime: number;
  inPointSeconds?: number;
  sourceDurationSeconds?: number;
  // Soft-cut: clip stays in the project but the Player skips it. Edit-time only.
  hidden?: boolean;
  cutReason?: StudioCutReason;
  // Canvas position/size/rotation. Undefined = full-frame (default).
  transform?: LayerTransform;
  // Mute the clip's own audio track in both preview and render. Undefined/false
  // = audible (default). The clip's video still shows; only its sound is dropped.
  muted?: boolean;
  // Playback gain 0..1 for the clip's audio. Undefined = full volume (1).
  // `muted` takes precedence (silences regardless of volume).
  volume?: number;
  // Stacked visual effects. Undefined/empty = none (default). At most one entry
  // per effect type. Order is irrelevant — opacity/transform/filter compose
  // commutatively in the composition.
  effects?: StudioEffect[];
  // Entrance/exit transitions. Undefined = a hard cut (default).
  transitionIn?: StudioClipTransition;
  transitionOut?: StudioClipTransition;
  // Camtasia-style animation arrows (scale/position/rotation/opacity tweens).
  // Undefined/empty = no motion (default). See StudioClipAnimation.
  animations?: StudioClipAnimation[];
}

// Audio clips live in a single store split across the SFX and Music timeline
// rows. `track` selects the row; dragging a clip vertically between rows flips
// it. SFX and Music render identically (Remotion <Audio>) — the distinction is
// purely organizational (and a hook for future per-track mixing).
export type StudioAudioTrackKind = 'sfx' | 'music';

export interface StudioAudioClip {
  id: string;
  importId?: string;
  filePath: string;
  fileName: string;
  track: StudioAudioTrackKind;
  startTime: number;
  endTime: number;
  inPointSeconds?: number;
  sourceDurationSeconds?: number;
  // Playback gain 0..1. Undefined = full volume (1).
  volume?: number;
}

// Image clips on the Image track — time-boxed visual layers painted above the
// video and below captions/TSX. `transform` reuses the shared LayerTransform so
// images can be positioned/sized like video clips and TSX overlays.
export interface StudioImageClip {
  id: string;
  importId?: string;
  filePath: string;
  fileName: string;
  startTime: number;
  endTime: number;
  transform?: LayerTransform;
  // Camtasia-style animation arrows. Undefined/empty = no motion (default).
  animations?: StudioClipAnimation[];
}

// Text blocks on the Text track — free-standing styled text painted above the
// video/image layers and below captions/TSX. Content is text + CSS (no asset
// file), so they render identically in preview and export. `transform` reuses
// the shared LayerTransform so a block can be dragged/sized/rotated like any
// other visual object.
export interface StudioTextStyle {
  fontFamily: string;
  fontSize: number; // composition px
  color: string; // hex
  fontWeight: number; // 400 | 700 | ...
  italic?: boolean;
  align: 'left' | 'center' | 'right';
  // Background/highlight box behind the text. `backgroundOpacity` (0..1) is
  // blended into `backgroundColor`; undefined color = no background.
  backgroundColor?: string;
  backgroundOpacity?: number;
  lineHeight?: number; // unitless multiplier
  letterSpacing?: number; // px
  shadow?: { x: number; y: number; blur: number; color: string };
  outline?: { width: number; color: string }; // px + hex
}

export interface StudioTextClip {
  id: string;
  text: string;
  style: StudioTextStyle;
  startTime: number;
  endTime: number;
  transform?: LayerTransform;
  // Camtasia-style animation arrows. Undefined/empty = no motion (default).
  animations?: StudioClipAnimation[];
}

export const DEFAULT_TEXT_STYLE: StudioTextStyle = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 72,
  color: '#FFFFFF',
  fontWeight: 700,
  align: 'center',
  lineHeight: 1.2,
};

// ─── Auto-cut analysis & plan ───
//
// `analysis` is the cached mechanical signal: transcript + silences + prosody.
// It survives between auto-cut runs so re-running only re-executes the AI pass.
//
// `cutPlan` is what Claude produced last; applied as `hidden` flags on clips.
// Both live on the project until the user "Bake & lock"s, which clears them.

export interface StudioAnalysisWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface StudioAnalysisUtterance {
  id: number;
  speaker?: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  words: StudioAnalysisWord[];
  disfluencies: { type: string; text: string; start: number; end: number }[];
  prosody: { meanRms: number; rmsVariance: number; speakingRateWpm: number };
}

export interface StudioAnalysisSilence {
  start: number;
  end: number;
  duration: number;
}

export interface StudioAnalysisHighlight {
  text: string;
  count: number;
  rank: number;
  timestamps: { start: number; end: number }[];
}

export interface StudioAnalysisJson {
  source: { filePath: string; duration: number; sampleRate: number };
  utterances: StudioAnalysisUtterance[];
  silences: StudioAnalysisSilence[];
  highlights: StudioAnalysisHighlight[];
  stats: {
    totalWords: number;
    totalDisfluencies: number;
    avgSpeakingRate: number;
    avgEnergy: number;
  };
  generatedAt: number;
}

export type StudioCutFlagType =
  | 'energy_dip'
  | 'filler_cluster'
  | 'hallucination_suspect'
  | 'long_silence_intentional'
  | 'heavy_cut_warning';

export interface StudioCutPlanCut {
  from: number; // source-time seconds
  to: number;
  type: StudioCutReason;
  reason: string;
}

export interface StudioCutPlanFlag {
  from: number;
  to: number;
  type: StudioCutFlagType;
  note: string;
}

export interface StudioCutPlan {
  cuts: StudioCutPlanCut[];
  flags: StudioCutPlanFlag[];
  stats: { sourceDuration: number; cutDuration: number; removedPercent: number };
  // Marked true once the user has reviewed at least once. Bake & lock is gated on this.
  reviewed?: boolean;
  generatedAt: number;
}

// Per-project timeline view preferences. Pure UI state (no effect on the
// render) — persisted so each project remembers how its timeline was set up.
export interface StudioTimelinePrefs {
  // Hide the file-name label painted on each clip. Useful once waveforms +
  // markers make the slots visually busy.
  hideFileNames?: boolean;
  // Hide the audio waveform drawn inside clips. Users can flip it on while
  // editing audio, then back off to declutter.
  hideWaveform?: boolean;
}

// Per-project panel layout. Saved sizes for the three resizable Studio panels
// so each project reopens with the same workspace dimensions. Widths are in px;
// `undefined` means "use the default ratio" (panel was never resized).
export interface StudioPanelLayout {
  // Left ControlPanel width (px).
  controlWidth?: number;
  // Right library panel width (px).
  libraryWidth?: number;
  // Timeline panel height (px). Includes the collapsed/maximized extremes.
  timelineHeight?: number;
}

export interface StudioProjectData {
  id: string;
  name: string;
  composition: StudioComposition;
  videoPath?: string;
  metadata?: VideoMetadata;
  createdAt: number;
  updatedAt: number;
  captions?: StudioProjectCaptions;
  tsxSuggestions?: TsxSuggestion[];
  tsxSlots?: TsxSlot[];
  imports?: StudioImport[];
  videoClips?: StudioVideoClip[];
  // SFX + Music clips (single store, split by `track`).
  audioClips?: StudioAudioClip[];
  // Image-track clips.
  imageClips?: StudioImageClip[];
  // Text-track clips (styled text blocks).
  textClips?: StudioTextClip[];
  // Free-form markdown — read by auto-cut and downstream skills.
  brand?: string;
  // Active brand from the global library, used for TSX analysis + generation.
  // Falls back to legacy `brand` string when unset.
  brandId?: string;
  // Active presets (composable guidelines) from the global library.
  // Multiple presets stack and are injected into the analysis prompt.
  presetIds?: string[];
  // Cached mechanical analysis (transcript + silences + prosody) — keyed implicitly to the project's
  // current source clip. Cleared on re-run; cleared on bake.
  analysis?: StudioAnalysisJson;
  // Last AI-produced cut proposal. Cleared on bake.
  cutPlan?: StudioCutPlan;
  // Per-project timeline view preferences (hide names / hide waveform).
  timelinePrefs?: StudioTimelinePrefs;
  // Per-project saved panel sizes (left / right / timeline).
  layout?: StudioPanelLayout;
}

export interface StudioProjectListResponse {
  success: boolean;
  projects?: StudioProjectData[];
  error?: string;
}

export interface StudioProjectSaveRequest {
  project: StudioProjectData;
}

export interface StudioProjectSaveResponse {
  success: boolean;
  error?: string;
}

export interface StudioProjectLoadRequest {
  id: string;
}

export interface StudioProjectLoadResponse {
  success: boolean;
  project?: StudioProjectData;
  error?: string;
}

export interface StudioProjectDeleteRequest {
  id: string;
}

export interface StudioProjectDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Studio TSX save ───
export interface StudioTsxSaveRequest {
  projectId: string;
  fileName: string;
  content: string;
}

export interface StudioTsxSaveResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface StudioTsxGetPathRequest {
  projectId: string;
  fileName: string;
}

export interface StudioTsxGetPathResponse {
  filePath: string;
}

// ─── Studio final-video render / export ───
//
// Export a Studio project (cut video clips + captions + ready TSX overlay
// slots) to MP4. The RENDERER builds StudioRenderInput from the same cut-time
// view that drives the <Player> (so what you preview is what you render); the
// MAIN process materializes a Remotion entry from it, bundles, and renders.
//
// All frame positions are in CUT-TIME — hidden clips are already collapsed out
// and visible clips re-anchored to contiguous time starting at frame 0.

export interface StudioRenderVideoClip {
  id: string;
  // Source video file on disk. Main rewrites this to a bundler-server asset
  // URL (http://127.0.0.1:<port>/asset?path=...) so headless Chromium can load it.
  filePath: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames: number;
  transform?: LayerTransform;
  // Drop this clip's audio from the muxed output. Default false (audible).
  muted?: boolean;
  // Playback gain 0..1. Undefined = full volume (1).
  volume?: number;
  // Per-clip visual effects (passed through unchanged from the edit-time clip;
  // see StudioEffect). Fade durations are in seconds, so they need no fps
  // rescaling when the export fps differs from the edit fps.
  effects?: StudioEffect[];
  // Entrance/exit transitions, durations already converted to frames at the
  // edit fps (so rescaleInputToFps adjusts them like every other frame value).
  transitionIn?: StudioRenderClipTransition;
  transitionOut?: StudioRenderClipTransition;
  // Animation arrows, start/duration already converted to frames at the edit fps.
  animations?: StudioRenderClipAnimation[];
}

// Frame-based transition descriptor used on the render path (the edit-time
// StudioClipTransition stores seconds; this is the converted form).
export interface StudioRenderClipTransition {
  type: StudioTransitionType;
  durationInFrames: number;
}

// Frame-based animation arrow used on the render path (the edit-time
// StudioClipAnimation stores clip-relative seconds; this is the converted form,
// at the edit fps so rescaleInputToFps adjusts it like every other frame value).
export interface StudioRenderClipAnimation {
  preset: StudioAnimationPreset;
  startFrames: number;
  durationFrames: number;
  from: StudioAnimationState;
  to: StudioAnimationState;
  direction?: 'up' | 'down' | 'left' | 'right';
  easing?: StudioAnimationEasing;
}

export interface StudioRenderSlot {
  id: string;
  // TSX file under userData/studio-projects/{projectId}/tsx/. Main reads it,
  // copies it into the render temp dir, and statically imports it in the entry.
  fileName: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames: number;
  transform?: LayerTransform;
}

export interface StudioRenderAudioClip {
  id: string;
  // Source audio file on disk. Main rewrites this to a bundler-server asset URL.
  filePath: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames: number;
  volume?: number;
}

export interface StudioRenderImageClip {
  id: string;
  // Source image file on disk. Main rewrites this to a bundler-server asset URL.
  filePath: string;
  startFrame: number;
  durationInFrames: number;
  transform?: LayerTransform;
  // Animation arrows (frame-based). Undefined/empty = no motion.
  animations?: StudioRenderClipAnimation[];
}

export interface StudioRenderTextClip {
  id: string;
  // Text content + style render straight to DOM/CSS — no asset file, so main
  // passes these through unchanged (no URL rewriting).
  text: string;
  style: StudioTextStyle;
  startFrame: number;
  durationInFrames: number;
  transform?: LayerTransform;
  // Animation arrows (frame-based). Undefined/empty = no motion.
  animations?: StudioRenderClipAnimation[];
}

export interface StudioRenderCaptions {
  // Cut-time caption segments (already remapped from source-time).
  segments: TranscriptSegment[];
  styleId: string;
  baseSettings: { position: { x: number; y: number }; fontSize: number };
  styleConfigs?: Record<string, unknown>;
}

export interface StudioRenderInput {
  projectId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  videoClips: StudioRenderVideoClip[];
  // SFX + Music clips merged (both render as <Audio>).
  audioClips: StudioRenderAudioClip[];
  // Image-track clips.
  imageClips: StudioRenderImageClip[];
  // Text-track clips (styled text blocks).
  textClips: StudioRenderTextClip[];
  // Only `ready` slots — pending/queued/generating/error slots are excluded
  // and surfaced as a pre-export warning in the UI.
  slots: StudioRenderSlot[];
  captions?: StudioRenderCaptions;
}

export interface StudioRenderStartRequest {
  input: StudioRenderInput;
  // Optional explicit output path. When omitted the handler writes into the
  // default output folder using the project name + timestamp.
  outputPath?: string;
  // Export settings (from the render-settings modal). All optional — the
  // handler applies sensible defaults (h264, full resolution, project fps).
  // `fps` here is the TARGET render fps; when it differs from `input.fps` the
  // handler rescales every frame value in the input so timing is preserved.
  codec?: RenderCodec;
  scale?: number;
  crf?: number;
  muted?: boolean;
  fps?: number;
  everyNthFrame?: number;
  numberOfGifLoops?: number | null;
  transparent?: boolean;
  cpuUsage?: string | null;
  gpuBackend?: RenderGpuBackend;
  hardwareAcceleration?: RenderHardwareAcceleration;
}

export interface StudioRenderStartResponse {
  success: boolean;
  jobId?: string;
  outputPath?: string;
  error?: string;
}

// ─── Studio mechanical analysis ───
// Stages 1-4 of the pipeline: audio extract + STT + silences + prosody.
// Output is `analysis.json` written to the per-project auto-cut workspace and
// `projectData.analysis` saved to the DB. Downstream skills (auto-cut planner,
// plan-tsx, plan-sfx, etc.) all consume this single cached signal.

export type StudioAnalyzeStage =
  | 'extract-audio'
  | 'transcribe'
  | 'silences'
  | 'prosody';

export interface StudioAnalyzeRunRequest {
  projectId: string;
  // The clip to analyze. v1 = single clip per run.
  clipId: string;
  // STT catalog id (@shared/presets/stt-models); defaults to local whisper.
  sttModelId?: string;
}

export interface StudioAnalyzeRunResponse {
  success: boolean;
  analysis?: StudioAnalysisJson;
  // Absolute path to the workspace dir (holds audio.wav, analysis.json, etc.)
  workspaceDir?: string;
  error?: string;
  cancelled?: boolean;
}

export interface StudioAnalyzeCancelRequest {
  projectId: string;
}

export interface StudioAnalyzeCancelResponse {
  success: boolean;
}

export interface StudioAnalyzeProgress {
  projectId: string;
  clipId: string;
  stage: StudioAnalyzeStage;
  percent: number;
  message: string;
}

// ─── Studio auto-cut (Claude planner) ───
// Stage 5 — requires analysis to already exist on the project.

export type StudioAutoCutStage = 'plan';

export interface StudioAutoCutRunRequest {
  projectId: string;
  // Optional override — if omitted the handler reads the project's stored brand.
  brand?: string;
}

export interface StudioAutoCutRunResponse {
  success: boolean;
  cutPlan?: StudioCutPlan;
  workspaceDir?: string;
  error?: string;
  cancelled?: boolean;
}

export interface StudioAutoCutCancelRequest {
  projectId: string;
}

export interface StudioAutoCutCancelResponse {
  success: boolean;
}

export interface StudioAutoCutProgress {
  projectId: string;
  stage: StudioAutoCutStage;
  percent: number;
  message: string;
}

// ─── Studio presets ───
// Global (cross-project) free-form prompt templates that act as Claude
// guidelines during auto-edit / TSX generation. CRUD only for now; the
// injection into the auto-cut planner / TSX generator lands later.

export interface StudioPreset {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudioPresetListResponse {
  success: boolean;
  presets?: StudioPreset[];
  error?: string;
}

export interface StudioPresetSaveRequest {
  preset: StudioPreset;
}

export interface StudioPresetSaveResponse {
  success: boolean;
  error?: string;
}

export interface StudioPresetDeleteRequest {
  id: string;
}

export interface StudioPresetDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Studio brands ───
// Global (cross-project) reusable brand profiles (voice, colors, aesthetic, etc.).
// CRUD only for now; per-project selection lands later. The legacy
// `StudioProjectData.brand` string remains the source-of-truth for auto-cut
// until that wiring ships.

export interface StudioBrand {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudioBrandListResponse {
  success: boolean;
  brands?: StudioBrand[];
  error?: string;
}

export interface StudioBrandSaveRequest {
  brand: StudioBrand;
}

export interface StudioBrandSaveResponse {
  success: boolean;
  error?: string;
}

export interface StudioBrandDeleteRequest {
  id: string;
}

export interface StudioBrandDeleteResponse {
  success: boolean;
  error?: string;
}
