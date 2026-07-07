import type { ComponentType } from 'react';
import type { TranscriptSegment } from '@shared/ipc/types';

// ─── Base settings shared by every style ──────────────────────────────────
// Position is in % of composition (centre = 50/50; bottom = 50/85). Font size
// is a multiplier on the style's intrinsic base size (1.0 = template default).
// These travel on the project as `StudioProjectCaptions.settings`.
export interface CaptionBaseSettings {
  position: { x: number; y: number };
  fontSize: number;
}

export const DEFAULT_BASE_SETTINGS: CaptionBaseSettings = {
  position: { x: 50, y: 85 },
  fontSize: 1.0,
};

// ─── Per-style settings ───────────────────────────────────────────────────
// Each style declares its own shape + defaults. The active shape is opaque to
// the storage layer (`StudioProjectCaptions.styleConfigs[styleId]: unknown`);
// the style's definition narrows it back at render time.

export interface BoldPopSettings {
  textColor: string;
  strokeColor: string;
  // Stroke thickness in CSS px (4 = current default).
  strokeWidth: number;
  // Highlight every Nth word with the accent colour (0 = no highlight).
  highlightEveryN: number;
  highlightColor: string;
}

export const DEFAULT_BOLD_POP_SETTINGS: BoldPopSettings = {
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 4,
  highlightEveryN: 0,
  highlightColor: '#FFD700',
};

export interface KaraokeSettings {
  activeColor: string;
  pastColor: string;
  futureColor: string;
  // Background pill behind the segment. 0 = no background.
  backgroundOpacity: number;
  backgroundColor: string;
}

export const DEFAULT_KARAOKE_SETTINGS: KaraokeSettings = {
  activeColor: '#FFD700',
  pastColor: '#FFD700',
  futureColor: '#FFFFFF',
  backgroundOpacity: 0.6,
  backgroundColor: '#000000',
};

export interface MinimalSettings {
  textColor: string;
  // 'none' renders text only; 'translucent' is the original semi-opaque bar;
  // 'solid' uses backgroundColor at full opacity.
  background: 'none' | 'translucent' | 'solid';
  backgroundColor: string;
}

export const DEFAULT_MINIMAL_SETTINGS: MinimalSettings = {
  textColor: '#FFFFFF',
  background: 'translucent',
  backgroundColor: '#000000',
};

// Hormozi — the "social-media bro" caption: big uppercase white text, thick
// black stroke, per-word pop entry, deterministic accent rule that paints one
// word per chunk in a contrast colour. Uses real word timestamps when present;
// falls back to character-distribution otherwise.
export interface HormoziSettings {
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  uppercase: boolean;
  // How accent words are picked:
  //   'longest'   — the longest word in each segment (signature Hormozi look)
  //   'every-nth' — every Nth word across the segment
  //   'none'      — no accent, all text in `textColor`
  accentMode: 'longest' | 'every-nth' | 'none';
  accentEveryN: number;
  accentColor: string;
  // Per-word pop intensity. 0 = no per-word animation (whole-segment scale
  // only). 1 = full bouncy entry on each word.
  perWordPop: number;
}

export const DEFAULT_HORMOZI_SETTINGS: HormoziSettings = {
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 6,
  uppercase: true,
  accentMode: 'longest',
  accentEveryN: 3,
  accentColor: '#FFEB3B',
  perWordPop: 1,
};

// Highlight Box — flat text, the currently spoken word gets a coloured pill
// painted behind it. Requires word timestamps for accurate alignment; falls
// back to character-distribution.
export interface HighlightBoxSettings {
  textColor: string;
  // Text colour inside the highlight pill (for legibility on bright fills).
  activeTextColor: string;
  // The pill colour painted behind the active word.
  highlightColor: string;
  // Stroke around all text (Hormozi-style). 0 = no stroke.
  strokeColor: string;
  strokeWidth: number;
  // Outer background bar behind the whole segment (0 = transparent).
  backgroundColor: string;
  backgroundOpacity: number;
  uppercase: boolean;
}

export const DEFAULT_HIGHLIGHT_BOX_SETTINGS: HighlightBoxSettings = {
  textColor: '#FFFFFF',
  activeTextColor: '#000000',
  highlightColor: '#FFEB3B',
  strokeColor: '#000000',
  strokeWidth: 4,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  uppercase: false,
};

// Word Pop — only the currently spoken word is on screen, big and centered.
// Springs in, holds, fades. Killer for hooks and punchy fact videos.
// Requires word timestamps for accurate per-word swap.
export interface WordPopSettings {
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  uppercase: boolean;
  // Spring damping for the per-word entry. Lower = bouncier.
  bounciness: number;
  // Hold value when "showBetweenWords" is true and the playhead is in a gap
  // between words: 'last' keeps the previous word; 'hide' shows nothing.
  betweenWords: 'last' | 'hide';
}

export const DEFAULT_WORD_POP_SETTINGS: WordPopSettings = {
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 6,
  uppercase: true,
  bounciness: 1,
  betweenWords: 'hide',
};

// ─── Registry types ───────────────────────────────────────────────────────
// `CaptionStyleId` is the string literal union of every registered id. When a
// new style is added, extend this and add an entry to the registry array in
// `templates/index.ts`. Everything else (storage, UI, picker) flows from
// there.
export type CaptionStyleId =
  | 'bold-pop'
  | 'karaoke'
  | 'minimal'
  | 'hormozi'
  | 'highlight-box'
  | 'word-pop';

export interface CaptionTemplateProps<S = unknown> {
  segments: TranscriptSegment[];
  baseSettings: CaptionBaseSettings;
  styleSettings: S;
  // The active style's id. Needed so templates can merge per-segment overrides
  // for THIS style (segments store overrides keyed by styleId).
  styleId: CaptionStyleId;
}

export interface CaptionConfigPanelProps<S> {
  settings: S;
  onChange: (next: S) => void;
}

// A style is fully described by this object — defaults, renderer, optional
// settings UI. Adding a new style = create the template file + add one entry
// to the registry array. Nothing else in the system needs to know about it.
export interface CaptionStyleDefinition<S = unknown> {
  id: CaptionStyleId;
  name: string;
  description: string;
  thumbnailColor: string;
  defaults: S;
  Component: ComponentType<CaptionTemplateProps<S>>;
  // Optional settings UI for the CaptionsTab right pane. If absent, only the
  // base settings (position, font size) are shown for this style.
  ConfigPanel?: ComponentType<CaptionConfigPanelProps<S>>;
}
