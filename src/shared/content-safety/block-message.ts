import type { ContentSafetyBlockInfo, ContentSafetyCategory } from './types';

const CATEGORY_LABELS: Record<ContentSafetyCategory, string> = {
  sexual: 'sexual content',
  nudity: 'nudity',
  pornography: 'pornographic content',
  explicit: 'explicit content',
  borderline: 'possibly explicit content',
};

/**
 * User-facing copy for a Content Safety block. Names the category, never the
 * matched term (D5). Used as the Error message main-side and rendered
 * verbatim by every generation surface.
 */
export function contentSafetyBlockMessage(info: ContentSafetyBlockInfo): string {
  const label = CATEGORY_LABELS[info.category] ?? 'explicit content';
  const detail =
    info.gate === 'prompt'
      ? 'Rephrase your prompt — VidTSX does not generate sexual or explicit content.'
      : 'The generated result was classified as unsafe and was discarded.';
  return `Blocked by Content Safety — ${label}. ${detail} See AI → Content Safety.`;
}
