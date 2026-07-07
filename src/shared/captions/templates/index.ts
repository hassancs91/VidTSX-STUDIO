// Style registry. Adding a new caption style = create a `<Style>.tsx` file
// that exports a Component + (optional) ConfigPanel + a default-settings
// object, then add one entry below. Everything else in the system — picker
// UI, settings UI, persistence, Player wiring — flows from this list.

import {
  type CaptionStyleDefinition,
  type CaptionStyleId,
  type BoldPopSettings,
  type KaraokeSettings,
  type MinimalSettings,
  type HormoziSettings,
  type HighlightBoxSettings,
  type WordPopSettings,
  DEFAULT_BOLD_POP_SETTINGS,
  DEFAULT_KARAOKE_SETTINGS,
  DEFAULT_MINIMAL_SETTINGS,
  DEFAULT_HORMOZI_SETTINGS,
  DEFAULT_HIGHLIGHT_BOX_SETTINGS,
  DEFAULT_WORD_POP_SETTINGS,
} from '../types';

import { BoldPopCaptions, BoldPopConfigPanel } from './BoldPopCaptions';
import { KaraokeCaptions, KaraokeConfigPanel } from './KaraokeCaptions';
import { MinimalCaptions, MinimalConfigPanel } from './MinimalCaptions';
import { HormoziCaptions, HormoziConfigPanel } from './HormoziCaptions';
import { HighlightBoxCaptions, HighlightBoxConfigPanel } from './HighlightBoxCaptions';
import { WordPopCaptions, WordPopConfigPanel } from './WordPopCaptions';

export { BoldPopCaptions, BoldPopConfigPanel } from './BoldPopCaptions';
export { KaraokeCaptions, KaraokeConfigPanel } from './KaraokeCaptions';
export { MinimalCaptions, MinimalConfigPanel } from './MinimalCaptions';
export { HormoziCaptions, HormoziConfigPanel } from './HormoziCaptions';
export { HighlightBoxCaptions, HighlightBoxConfigPanel } from './HighlightBoxCaptions';
export { WordPopCaptions, WordPopConfigPanel } from './WordPopCaptions';
export { CaptionPreviewComposition } from './CaptionPreviewComposition';
export type { CaptionPreviewCompositionProps } from './CaptionPreviewComposition';

// Heterogenous registry — each entry's settings shape is narrowed by its
// declared definition. The `any` here is unavoidable for the array literal,
// but the per-style typing is preserved at the call site via `defaults`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CAPTION_STYLES: ReadonlyArray<CaptionStyleDefinition<any>> = [
  {
    id: 'bold-pop',
    name: 'Bold Pop',
    description: 'Large, animated text with pop-in effect',
    thumbnailColor: '#7F77DD',
    defaults: DEFAULT_BOLD_POP_SETTINGS,
    Component: BoldPopCaptions,
    ConfigPanel: BoldPopConfigPanel,
  } satisfies CaptionStyleDefinition<BoldPopSettings>,
  {
    id: 'hormozi',
    name: 'Hormozi',
    description: 'Big uppercase, per-word pop, longest-word accent — the bro classic',
    thumbnailColor: '#FFEB3B',
    defaults: DEFAULT_HORMOZI_SETTINGS,
    Component: HormoziCaptions,
    ConfigPanel: HormoziConfigPanel,
  } satisfies CaptionStyleDefinition<HormoziSettings>,
  {
    id: 'highlight-box',
    name: 'Highlight Box',
    description: 'Active word painted with a coloured pill — follow-the-ball',
    thumbnailColor: '#F09595',
    defaults: DEFAULT_HIGHLIGHT_BOX_SETTINGS,
    Component: HighlightBoxCaptions,
    ConfigPanel: HighlightBoxConfigPanel,
  } satisfies CaptionStyleDefinition<HighlightBoxSettings>,
  {
    id: 'word-pop',
    name: 'Word Pop',
    description: 'One word at a time, huge and centred — hook mode',
    thumbnailColor: '#85B7EB',
    defaults: DEFAULT_WORD_POP_SETTINGS,
    Component: WordPopCaptions,
    ConfigPanel: WordPopConfigPanel,
  } satisfies CaptionStyleDefinition<WordPopSettings>,
  {
    id: 'karaoke',
    name: 'Karaoke',
    description: 'Word-by-word highlight effect',
    thumbnailColor: '#5DCAA5',
    defaults: DEFAULT_KARAOKE_SETTINGS,
    Component: KaraokeCaptions,
    ConfigPanel: KaraokeConfigPanel,
  } satisfies CaptionStyleDefinition<KaraokeSettings>,
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple, clean subtitle style',
    thumbnailColor: '#EF9F27',
    defaults: DEFAULT_MINIMAL_SETTINGS,
    Component: MinimalCaptions,
    ConfigPanel: MinimalConfigPanel,
  } satisfies CaptionStyleDefinition<MinimalSettings>,
];

export function getStyleDefinition(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): CaptionStyleDefinition<any> | undefined {
  return CAPTION_STYLES.find((s) => s.id === id);
}

// Merge persisted style-config blobs with a style's declared defaults so the
// template always receives a fully-populated settings object. Missing keys
// (older project, partial migration, new fields added since save) fall back
// to defaults.
export function resolveStyleSettings<S>(
  id: CaptionStyleId,
  styleConfigs: Record<string, unknown> | undefined,
): S {
  const def = getStyleDefinition(id);
  if (!def) {
    // Fallback for unknown ids — empty object. Templates should never see
    // this unless the project references a style that's been removed.
    return {} as S;
  }
  const stored = (styleConfigs?.[id] ?? {}) as Partial<S>;
  return { ...(def.defaults as S), ...stored };
}
