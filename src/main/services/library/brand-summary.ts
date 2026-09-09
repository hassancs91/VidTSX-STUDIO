// The brand as an agent reads it (W4): one formatter for the Studio agent's
// `get_brand` and the shared agents registry's `get_brand`, so both chats
// describe a brand in the same words — palette, fonts, logos, style notes
// and the vocabulary the transcriber and the writer must both spell right.

import type { StudioBrand } from '../../../shared/types/asset-library';
import { formatVocabularyLines } from '../../../shared/studio/brand-vocabulary';

export interface BrandSummaryOptions {
  /** Prefix for logo paths (Studio uses `library:` refs; agents use bare
   *  library-relative paths). */
  logoRefPrefix?: string;
}

export function formatBrandSummary(brand: StudioBrand, options: BrandSummaryOptions = {}): string {
  const prefix = options.logoRefPrefix ?? '';
  const palette = Object.entries(brand.palette)
    .map(([role, value]) => `${role} ${String(value)}`)
    .join(', ');
  const lines = [
    `Brand "${brand.name}" (id ${brand.id})`,
    `Palette: ${palette}`,
    `Fonts: display ${brand.fonts.display}${brand.fonts.body ? `, body ${brand.fonts.body}` : ''}`,
    brand.logoRefs.length > 0
      ? `Logos: ${brand.logoRefs.map((r) => `${prefix}${r}`).join(', ')}`
      : 'Logos: none',
    brand.styleNotes ? `Style notes:\n${brand.styleNotes}` : 'Style notes: none',
  ];
  const vocabulary = formatVocabularyLines(brand.vocabulary);
  lines.push(
    vocabulary.length > 0
      ? `Vocabulary (spell these exactly; the transcriber is primed with them):\n${vocabulary.join('\n')}`
      : 'Vocabulary: none yet',
  );
  return lines.join('\n');
}
