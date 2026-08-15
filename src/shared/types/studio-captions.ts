// Caption layer types (D13) — docs/studio/CAPTIONS_DESIGN.md §C1/§C3.
//
// Two halves live here:
//   1. the DOCUMENT model (`StudioCaptionLayer`) — one layer per project,
//      spanning the whole master lane, stored in project.json;
//   2. the TEMPLATE RUNTIME CONTRACT (`CaptionRuntimeProps`) — what a caption
//      template component receives as props. Nothing is ever baked into
//      template code: the serializer derives the word stream from the timeline
//      at serialize time and passes it through D12's runtime-props channel, so
//      cutting the master lane re-derives the captions on the next serialize.
//
// Pack authors write against the runtime half; it is a published contract
// (PACKS_DESIGN.md), so treat changes to it as breaking.

export type StudioCaptionPosition = 'bottom' | 'center' | 'top';

/** Explicit color override — same five roles as a brand palette, so switching
 *  between 'brand' and custom is a straight swap for every template. */
export interface StudioCaptionColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

export interface StudioCaptionStyle {
  position: StudioCaptionPosition;
  /** 1 = the template's default size for the aspect; the manifest supplies the
   *  per-aspect base and this multiplies it. */
  scale: number;
  /** 1–6. Templates may interpret loosely (a one-word template pins it to 1). */
  wordsPerGroup: number;
  uppercase: boolean;
  /** 'brand' = resolve from the project's active brand at serialize time. */
  colors: 'brand' | StudioCaptionColors;
}

export interface StudioCaptionLayer {
  /** Namespaced pack item id, e.g. 'core/word-pop' (PACKS_DESIGN.md). A
   *  templateId whose pack is no longer installed degrades gracefully — the
   *  layer renders nothing and the panel says so (stale-brandId precedent). */
  templateId: string;
  /** Toggle without losing the configured style. */
  enabled: boolean;
  style: StudioCaptionStyle;
}

// ---------------------------------------------------------------------------
// Template runtime contract — what the serializer hands a template component.
// ---------------------------------------------------------------------------

/** One word, in TIMELINE seconds (already re-based from source media). */
export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

/** A display unit: the words a template shows at once. Templates decide the
 *  highlight behavior themselves from the per-word timings. */
export interface CaptionGroup {
  start: number;
  end: number;
  words: CaptionWord[];
}

/** Colors + font a template paints with — resolved (brand or override) before
 *  it arrives, so templates never read the brand system. */
export interface CaptionPalette extends StudioCaptionColors {
  fontFamily: string;
}

/** The style members a template actually renders with (`colors` is already
 *  resolved into `palette`, so it is not repeated here). */
export interface ResolvedCaptionStyle {
  position: StudioCaptionPosition;
  scale: number;
  wordsPerGroup: number;
  uppercase: boolean;
}

/** The props every caption template receives. */
export interface CaptionRuntimeProps {
  groups: CaptionGroup[];
  style: ResolvedCaptionStyle;
  palette: CaptionPalette;
}
