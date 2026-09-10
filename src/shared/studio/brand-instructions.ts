// The brand contract a TSX composition is generated under — the block the
// TSX Creator injects as `extraInstructions` in prompt mode, and (W7) the one
// `generate_composition` injects on its own when the agent session has a
// brand, so both modes of the Creator build under the SAME words (V1
// completion plan §0 decision 7).
//
// Shared and pure: the renderer hook and the main-process tool import it.
// The Studio shot prompt carries its own, shot-kind-aware form of the same
// contract (`shot-prompt.ts`); this is the project-less one.

import type { StudioBrand } from '../types/asset-library';

export function buildBrandInstructions(brand: StudioBrand): string {
  const p = brand.palette;
  const lines = [
    `Brand "${brand.name}" (MANDATORY styling): every color and font comes from the brand — do not invent your own palette.`,
    `Colors — primary ${p.primary}, secondary ${p.secondary}, background ${p.background}, text ${p.text}, accent ${p.accent} (use the accent sparingly for emphasis).`,
    `Fonts — display (headings/numbers): "${brand.fonts.display}"; body (labels/paragraphs): "${brand.fonts.body ?? brand.fonts.display}". Do NOT import any font package — set fontFamily strings directly, with a sans-serif fallback.`,
  ];
  if (brand.styleNotes) {
    lines.push(`Brand style notes (follow them): ${brand.styleNotes}`);
  }
  return lines.join('\n');
}
