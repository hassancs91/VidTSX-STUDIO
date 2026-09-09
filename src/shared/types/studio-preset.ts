// Editing presets (V1 completion plan §2.5, decision §0.6): one playbook per
// kind of video — "my shorts", "course lessons" — made of a skill-like
// instruction body (PRESET.md), structured style knobs and the workflow the
// Studio agent follows every time. A library entity like brands: stored
// folder-as-truth at `<assetsRoot>/presets/<id>/` (preset.json + PRESET.md,
// optional skills/), selected per project, and written by "learn from this
// video" only through a card the user accepts.

export type StudioPresetVideoKind = 'short' | 'long' | 'course' | 'custom';
export type StudioPresetOrientation = '16:9' | '9:16' | '1:1';
export type StudioPresetPacing = 'tight' | 'normal' | 'relaxed';
export type StudioPresetMusicBed = 'none' | 'quiet' | 'present';
export type StudioPresetCaptions = 'none' | 'karaoke' | 'block';

/** The structured knobs, all optional — the body carries the prose. */
export interface StudioPresetStyle {
  pacing?: StudioPresetPacing;
  shotsPerMinute?: number;
  sfxPerMinute?: number;
  musicBed?: StudioPresetMusicBed;
  captions?: StudioPresetCaptions;
  transitions?: string[];
  introSeconds?: number;
  outroSeconds?: number;
}

/** One workflow step, in the order the agent runs them (the W3 tools). */
export type PresetStep =
  | { id: 'transcribe'; engine?: string }
  | { id: 'auto_cut'; aggressiveness?: 'light' | 'normal' | 'aggressive' }
  | { id: 'editorial' }
  | { id: 'shots'; cadence?: number }
  | { id: 'broll'; source?: 'generate' | 'library' }
  | { id: 'sfx' }
  | { id: 'music' }
  | { id: 'captions'; template?: string }
  | { id: 'export'; renderPreset?: string };

export type PresetStepId = PresetStep['id'];

/** Every step id, in the canonical end-to-end order. */
export const PRESET_STEP_IDS: readonly PresetStepId[] = [
  'transcribe',
  'auto_cut',
  'editorial',
  'shots',
  'broll',
  'sfx',
  'music',
  'captions',
  'export',
];

/** One "learn from this video" acceptance, newest last. */
export interface StudioPresetLearned {
  projectId: string;
  /** ISO timestamp of the accept. */
  at: string;
  /** The one-line summary the card carried. */
  summary: string;
}

/**
 * The preset document (`preset.json`). `id` IS the folder slug. The
 * instruction body lives beside it as `PRESET.md` and travels as
 * `StudioPresetEntry.body` over IPC.
 *
 * W8 Stage 4 reserve: `workflow` may later reference a flow
 * (`workflow: { flowId }`). Declared here so nothing else claims the shape;
 * NOT built in V1 — the normaliser only reads the step array.
 */
export interface StudioPreset {
  id: string;
  name: string;
  description?: string;
  videoKind: StudioPresetVideoKind;
  orientation?: StudioPresetOrientation;
  /** A library brand id the project takes at creation when it has no
   *  explicit choice. Never touches the brand itself (its vocabulary
   *  included). */
  defaultBrandId?: string;
  /** Ordered; the agent follows it. */
  workflow: PresetStep[];
  style: StudioPresetStyle;
  learned?: StudioPresetLearned[];
  createdAt: string;
  updatedAt: string;
}

/** The preset plus its PRESET.md body — what the store returns and the
 *  dialog edits. */
export interface StudioPresetEntry extends StudioPreset {
  body: string;
}

/** Cap on PRESET.md (the editor refuses more). The prompt carries the first
 *  PRESET_PROMPT_BUDGET chars; `get_preset` reads the rest. */
export const PRESET_BODY_MAX = 12_000;

/** Character budget for the composed "## Editing preset" block (§2.5, §5
 *  question 4 — measure adherence before raising it). */
export const PRESET_PROMPT_BUDGET = 4000;

/** Learned entries kept on a preset — older ones roll off. */
export const PRESET_LEARNED_MAX = 20;

// ---------------------------------------------------------------------------
// Learn from this video (§2.5) — the deterministic measurement of one edit,
// the knob diff it implies, and the card the user accepts.
// ---------------------------------------------------------------------------

/** What learn-from-project measured on the timeline, all deterministic. */
export interface StudioPresetLearnStats {
  totalSeconds: number;
  /** Clips on the master (first video) lane. */
  masterClipCount: number;
  /** Boundaries on the master lane per minute of finished video. */
  cutsPerMinute: number;
  meanClipSeconds: number;
  /** Seconds removed by accepted items of applied cut plans. */
  removedSeconds: number;
  shotCount: number;
  shotsPerMinute: number;
  /** Media clips on overlay lanes (b-roll / picture overlays). */
  brollCount: number;
  sfxCount: number;
  sfxPerMinute: number;
  musicBed: StudioPresetMusicBed;
  captions: StudioPresetCaptions;
  captionTemplateId?: string;
  /** Transition kinds used, with counts, sorted by kind. */
  transitions: Array<{ kind: string; count: number }>;
  introSeconds: number;
  outroSeconds: number;
  /** Clips by who placed them (`origin.by`; absent counts as user). */
  userClipCount: number;
  agentClipCount: number;
  /** The review history: what the agent proposed and what the user kept. */
  proposalsApplied: number;
  proposalsRejected: number;
  cutItemsProposed: number;
  cutItemsRejected: number;
  cutItemsAdjusted: number;
}

export type StudioPresetKnobKey = keyof StudioPresetStyle;

/** One knob the card proposes to change, with the measurement behind it. */
export interface StudioPresetKnobChange {
  key: StudioPresetKnobKey;
  from?: string | number | string[];
  to: string | number | string[];
  /** The numbers that justify it, one line. */
  reason: string;
}

/** The pending "update the preset?" card. Accept writes the preset (knobs
 *  patched, the learned section appended to PRESET.md, one learned-log
 *  entry); reject discards. Nothing is inferred silently. */
export interface StudioPresetUpdateProposal {
  id: string;
  projectId: string;
  projectName: string;
  presetId: string;
  presetName: string;
  stats: StudioPresetLearnStats;
  /** One deterministic sentence with the headline numbers. */
  statsSummary: string;
  /** The ONE LLM summary (or the agent's, when it passed one). */
  summary: string;
  /** True when the summary is the deterministic fallback (LLM unavailable). */
  summaryFallback?: boolean;
  knobChanges: StudioPresetKnobChange[];
  /** The style after the changes — what accept writes. */
  proposedStyle: StudioPresetStyle;
  /** The markdown section accept appends to PRESET.md. */
  learnedSection: string;
  note?: string;
  createdAt: string;
}
