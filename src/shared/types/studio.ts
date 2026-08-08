// Studio timeline document schema, v1 — see docs/studio/PLAN.md §4.
//
// Unit discipline: all times are SECONDS (float), either on the project
// timeline (`timelineStart`) or inside source media (`sourceIn`). Never
// milliseconds, never frames — frames exist only at the Remotion boundary via
// a single cumulative-rounding conversion helper (Phase S2).
//
// Shared between main (project-store, media-import) and renderer (editor UI).

import type { SttModelFeatures } from '../presets/stt-models';

export const STUDIO_SCHEMA_VERSION = 1;

export type StudioAssetKind = 'video' | 'audio' | 'image';

export interface StudioAssetProbe {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  codec?: string;
}

export type StudioCacheStatus = 'pending' | 'generating' | 'ready' | 'error';

export interface StudioAssetCacheFile {
  /** Path relative to the project's cache/ folder. */
  path: string;
  status: StudioCacheStatus;
}

export interface StudioAssetTranscript extends StudioAssetCacheFile {
  engine: 'whisper' | 'assemblyai';
  /** STT catalog id used (e.g. 'local-whisper/base'), for re-transcribe UX. */
  sttModelId?: string;
  language?: string;
  /** True when word-level timestamps are available (required for auto-cut). */
  hasWords: boolean;
  wordCount?: number;
  /**
   * Snapshot of what the engine actually delivered at transcription time
   * (measured vs approximate timing, verbatim disfluencies, speakers, …).
   * Recorded here because the catalog can change under an old transcript, and
   * because a run can deliver less than the catalog advertises. Consumers
   * branch on these flags, never on `engine`.
   */
  features?: SttModelFeatures;
}

/** The transcript fields a job event carries (path/status ride separately). */
export type StudioAssetTranscriptMeta = Omit<StudioAssetTranscript, 'path' | 'status'>;

export interface StudioMediaAsset {
  id: string;
  kind: StudioAssetKind;
  /** Absolute path to the original file, referenced in place. */
  path: string;
  probe: StudioAssetProbe;
  /** Content hash for relink-when-missing. */
  hash?: string;
  thumbnail?: StudioAssetCacheFile;
  proxy?: StudioAssetCacheFile;
  waveform?: StudioAssetCacheFile;
  transcript?: StudioAssetTranscript;
}

export type StudioTrackKind = 'video' | 'overlay' | 'audio' | 'caption';

export type StudioClipKind = 'video' | 'audio' | 'image' | 'tsx' | 'caption' | 'sfx';

export interface StudioClipTransform {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}

/** TSX shot semantics (from the reference pipeline): on a `video` track the
 *  shot is a cutaway (replaces picture, master audio continues); on an
 *  `overlay` track it composites transparently over the picture. */
export interface StudioClipTsx {
  /** Path relative to the project's shots/ folder. */
  filePath: string;
  mode: 'cutaway' | 'overlay';
}

export interface StudioClipOrigin {
  by: 'user' | 'agent';
  proposalId?: string;
}

export interface StudioClip {
  id: string;
  kind: StudioClipKind;
  assetId?: string;
  /** Seconds on the project timeline. */
  timelineStart: number;
  /** Seconds on the project timeline. */
  duration: number;
  /** Seconds into the source media (media clips only). */
  sourceIn?: number;
  speed?: number;
  gain?: number;
  transform?: StudioClipTransform;
  tsx?: StudioClipTsx;
  origin?: StudioClipOrigin;
  label?: string;
  note?: string;
}

export interface StudioTrack {
  id: string;
  kind: StudioTrackKind;
  name: string;
  muted?: boolean;
  locked?: boolean;
  hidden?: boolean;
  clips: StudioClip[];
}

export interface StudioTimeline {
  tracks: StudioTrack[];
}

// ---------------------------------------------------------------------------
// Proposals — the audit gate. Bulk/destructive agent edits land here first and
// only mutate the timeline when the user accepts them (per item or wholesale).
// ---------------------------------------------------------------------------

export type StudioProposalKind = 'cut-plan' | 'sfx-plan' | 'shot-plan';

export type StudioProposalStatus = 'proposed' | 'applied' | 'rejected' | 'partial';

/** Cut categories from the reference clean-cut pipeline. */
export type StudioCutCategory =
  | 'retake'
  | 'false_start'
  | 'filler'
  | 'long_pause'
  | 'dead_air'
  | 'fluff'
  | 'user_cut';

export interface StudioProposalItem {
  id: string;
  status: 'proposed' | 'accepted' | 'rejected';
  /** Cut plans: the span to remove, in source-media seconds. */
  assetId?: string;
  sourceStart?: number;
  sourceEnd?: number;
  category?: StudioCutCategory;
  /** Transcript text covered by the span (what gets cut). */
  text?: string;
  /** The agent's reasoning, shown in the review UI. */
  note?: string;
}

export interface StudioProposal {
  id: string;
  kind: StudioProposalKind;
  status: StudioProposalStatus;
  createdAt: string;
  agentNote?: string;
  items: StudioProposalItem[];
}

// ---------------------------------------------------------------------------
// Project document
// ---------------------------------------------------------------------------

export interface StudioAgentSettings {
  providerId?: string;
  model?: string;
}

export interface StudioProjectSettings {
  width: number;
  height: number;
  fps: number;
  agent: StudioAgentSettings;
  /**
   * STT catalog id used for per-asset transcription (Inspector picker).
   * Absent = the app default (local whisper).
   */
  sttModelId?: string;
}

export interface StudioProject {
  schemaVersion: typeof STUDIO_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: StudioProjectSettings;
  assets: StudioMediaAsset[];
  timeline: StudioTimeline;
  proposals: StudioProposal[];
}
