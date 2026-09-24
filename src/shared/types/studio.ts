// Studio timeline document schema, v1 — see docs/studio/PLAN.md §4.
//
// Unit discipline: all times are SECONDS (float), either on the project
// timeline (`timelineStart`) or inside source media (`sourceIn`). Never
// milliseconds, never frames — frames exist only at the Remotion boundary via
// a single cumulative-rounding conversion helper (Phase S2).
//
// Shared between main (project-store, media-import) and renderer (editor UI).

import type { ReactNode } from 'react';
import type { SttModelFeatures } from '../presets/stt-models';
import type { ThinkingLevel } from '../tsx-engine/types';
import type { CaptionRuntimeProps, StudioCaptionLayer } from './studio-captions';

// Caption types are a sibling file (they are a published contract for pack
// authors), re-exported here so every consumer keeps one import site.
export * from './studio-captions';

export const STUDIO_SCHEMA_VERSION = 1;

/** Cap on `StudioProject.script` (W4) — a long-form script, never a book. */
export const STUDIO_SCRIPT_MAX_CHARS = 60_000;

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
  engine: 'whisper' | 'assemblyai' | 'elevenlabs';
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
  /** W4: keyterms the engine was primed with (brand vocabulary, script
   *  names, vocabulary memories); absent = none were available. */
  keytermCount?: number;
  /** W4: alias → term replacements the post-pass made in the word list. */
  aliasReplacements?: number;
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
  /** Human/AI caption. Carried from the library index on import-on-use (D12);
   *  what the agent reads to pick the right asset. */
  description?: string;
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

/** TSX shot reference (S4). The clip points at a `StudioShot` registry entry
 *  by id — never at a file path — so edit/regenerate round-trips are one
 *  `activeVersion` bump on the shot, not a clip sweep. `mode` is explicit on
 *  the clip (not derived from track kind): it records compositing intent —
 *  cutaway = opaque full-frame cover, overlay = transparent composite — and a
 *  drag between lanes must not silently change it. */
export interface StudioClipTsx {
  shotId: string;
  mode: 'cutaway' | 'overlay';
}

export interface StudioClipOrigin {
  by: 'user' | 'agent';
  proposalId?: string;
}

/** `'crossfade'` / `'dip-to-black'` — the two the engine draws itself — or a
 *  pack transition's namespaced id, `<packId>/<itemId>` (e.g. `core/push-left`).
 *  The bare ids stay valid forever and the schema version does not move: an
 *  older build opening a newer project renders an id it doesn't know as a
 *  crossfade instead of refusing the document. An id whose pack isn't installed
 *  degrades the same way and STAYS in the document, so reinstalling restores it.
 *  See docs/studio/TRANSITION_PACKS_DESIGN.md. */
export type StudioTransitionKind = string;

/** A transition at the clip's END boundary (additive, Slice E). Stored on the
 *  leading clip; meaningful only while the next clip on the same track starts
 *  exactly at this clip's end — the reducer prunes it the moment an edit
 *  breaks that contiguity. The document never stores an overlap; render-time
 *  serialization builds one. See docs/studio/TRANSITIONS_DESIGN.md. */
export interface StudioClipTransition {
  kind: StudioTransitionKind;
  /** Total transition length in timeline seconds, centered on the cut. */
  duration: number;
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
  /** Audio fade-in/out lengths in timeline seconds (additive, Slice C1).
   *  Invariant kept by the ops: both ≥ 0 and their sum ≤ duration. */
  fadeInSec?: number;
  fadeOutSec?: number;
  transitionOut?: StudioClipTransition;
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

/** A named point on the project timeline (additive, Slice D1). Timeline-level,
 *  not per-track — markers annotate the edit, they don't belong to media. */
export interface StudioMarker {
  id: string;
  /** Seconds on the project timeline, ≥ 0. */
  time: number;
  label?: string;
  /** CSS color for the ruler diamond; absent = the UI default. */
  color?: string;
}

export interface StudioTimeline {
  tracks: StudioTrack[];
  /** Kept sorted by time by the marker ops; absent when there are none. */
  markers?: StudioMarker[];
}

// ---------------------------------------------------------------------------
// TSX shots (S4) — generated compositions the timeline references by id.
// See docs/studio/TSX_SHOTS_DESIGN.md D1/D9.
// ---------------------------------------------------------------------------

export type StudioShotKind = 'cutaway' | 'overlay' | 'title';

export type StudioShotStatus = 'generating' | 'ready' | 'error';

export interface StudioShot {
  /** Also the folder name under the project's shots/ directory. */
  id: string;
  /** Display name, from the brief. */
  name: string;
  /** `title` is a skill category of overlay (text-first + word-synced), not a
   *  third rendering mode — clips still carry mode 'cutaway' | 'overlay'. */
  kind: StudioShotKind;
  createdAt: string;
  /** Version the timeline uses, e.g. 2 → shots/<id>/v2.tsx. Disk versions are
   *  append-only; this pointer is document state, so switching is undoable. */
  activeVersion: number;
  status: StudioShotStatus;
  /** Snapshot of the shot's own compositionConfig (fps/dims/frames). */
  config?: { durationInFrames: number; fps: number; width: number; height: number };
  /** What the shot was synced to — enables regenerate re-sync (D7). */
  anchor?: { assetId: string; sourceStart: number; sourceEnd: number };
  /** Media inside the shot (D12): ref key → project asset id. The serializer
   *  resolves each ref to a per-environment URL and passes the map to the
   *  component as its `assets` prop; generated code writes
   *  `<Img src={assets.key}>`, never a file path. */
  assetRefs?: Record<string, string>;
  /** Original brief, for the inspector. */
  prompt?: string;
  origin?: StudioClipOrigin;
  error?: string;
}

/** Props the serializer passes to a shot component at render time (D12).
 *  A general channel, extensible by design — D13 captions rides it next with
 *  a live word-stream member; add siblings here, never a parallel mechanism. */
export interface ShotRuntimeProps {
  /** Resolved asset URLs keyed by the shot's assetRef keys. */
  assets?: Record<string, string>;
  /** D13 captions: the word stream derived from the master lane at serialize
   *  time, plus the resolved style/palette. Present only on the serializer's
   *  caption overlay entry — a shot never sees it. Captions ride this channel
   *  ON PURPOSE: one props transport, so preview and export can't diverge. */
  captions?: CaptionRuntimeProps;
}

/** Props a pack transition's component receives across its overlap. The
 *  contract is the add-ons repo's (`vidtsx-addons/transitions/AUTHORING.md`);
 *  the component eases `progress` itself and must render only `outgoing` at 0
 *  and only `incoming` at 1. Both scene nodes are PICTURE-ONLY — a transition
 *  may mount a scene many times, so sound is never inside them. */
export interface TransitionRuntimeProps {
  outgoing: ReactNode;
  incoming: ReactNode;
  /** Linear 0→1 across the overlap. */
  progress: number;
  /** Composition pixels. */
  width?: number;
  height?: number;
  accent?: string;
  /** Backing colour behind 3D motion and dips. The engine passes
   *  'transparent' so lower tracks (or the composition's black) show through. */
  background?: string;
}

// ---------------------------------------------------------------------------
// Proposals — the audit gate. Bulk/destructive agent edits land here first and
// only mutate the timeline when the user accepts them (per item or wholesale).
// ---------------------------------------------------------------------------

export type StudioProposalKind = 'cut-plan' | 'sfx-plan' | 'shot-plan' | 'insert-plan';

/** Which lane an inserted media clip lands on (W3 `insert_asset`): b-roll
 *  and overlays both ride the overlay lane (covering, never displacing — the
 *  shot rule D2); audio goes to an audio lane. */
export type StudioInsertLane = 'broll' | 'overlay' | 'audio';

/** Insert plans (W3): ONE media clip to place. Placement reuses the item's
 *  anchor fields (`assetId`/`sourceStart`/`sourceEnd` name a span on the
 *  FOOTAGE, renderer-mapped at apply) or the `timelineStart` fallback, and
 *  `duration` is always explicit — the reducer never sees the asset. */
export interface StudioInsertSpec {
  /** The project asset to insert (not the anchor asset). */
  assetId: string;
  kind: 'video' | 'audio' | 'image';
  lane: StudioInsertLane;
  /** Audio gain multiplier for the new clip (1 = unity). */
  gain?: number;
}

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
  /** True once the user has dragged this span's edges — provenance stays honest. */
  adjusted?: boolean;
  // Shot plans (S4 D8). Placement is source-anchored via assetId/sourceStart
  // above, renderer-mapped at review AND apply (the cut-proposal discipline);
  // `timelineStart` is the fallback for UNANCHORED shots only.
  shotId?: string;
  timelineStart?: number;
  /** Clip length in timeline seconds (defaults to the shot's config length). */
  duration?: number;
  mode?: 'cutaway' | 'overlay';
  /** Insert plans (W3): the media clip this item places. */
  insert?: StudioInsertSpec;
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
  /** Absent = the app's active provider. */
  providerId?: string;
  /** Planning model — the chat turn itself. Absent = the provider's default. */
  model?: string;
  /** Model for TSX shot generation (`generate_tsx_shot`, Media Pool shots).
   *  Absent = `model`, then the provider's default. */
  shotModel?: string;
  /** Thinking dial for the planning turn ('off' | 'medium' | 'max' in the UI;
   *  any ThinkingLevel is accepted). Absent = off. */
  thinking?: ThinkingLevel;
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
  /**
   * Active brand for shot generation (D11) — a brand id in the app-level
   * library. Copied from the Studio default at creation (explicit snapshot);
   * switchable per project any time. Absent = no brand injection.
   */
  brandId?: string;
  /**
   * Editing preset (V1 completion plan §2.5) — a preset id in the app-level
   * library. Its PRESET.md rides the assistant's system prompt and its
   * workflow is the order the agent follows for a full edit. Absent = no
   * preset; a stale id (preset deleted) degrades to none.
   */
  presetId?: string;
  /**
   * The Export dialog's last output choice for this project (docs/studio/
   * EXPORT_OUTPUT_OPTIONS_PLAN.md): a resolution preset id and a quality
   * level from `src/shared/render-presets.ts`. Absent = the project size at
   * the default quality. Unknown values fall back the same way.
   */
  export?: {
    resolution: string;
    quality: string;
    /** 'original' | 'proxy' (`src/shared/studio/export-source.ts`); absent = the automatic default. */
    source?: string;
  };
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
  /** TSX shot registry (S4). Normalized to [] on load — no schema bump: no
   *  document shipped before this field existed with a tsx clip in it. */
  shots: StudioShot[];
  /** Caption layer (D13) — ONE layer, spanning the master lane. Absent = no
   *  captions; no schema bump (the shots-field precedent). The words are NOT
   *  stored: they are derived from the timeline on every serialize. */
  captions?: StudioCaptionLayer;
  /** The script (W4): the INTENDED FINAL READ, edited in the Script tab.
   *  The editorial pass reads it to pick the keeper take, its proper nouns
   *  prime every transcription, and the agent proposes vocabulary from it.
   *  Absent = none; capped at STUDIO_SCRIPT_MAX_CHARS; no schema bump (the
   *  captions precedent — optional field, older readers ignore it). */
  script?: string;
}
