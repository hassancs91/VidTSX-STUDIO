// Brand input validation + document normalization (ASSET_LIBRARY_DESIGN.md
// L3, TSX_SHOTS_DESIGN.md D11). Pure — used by the main brand-store on load/
// save and by the renderer form for inline feedback.

import type { StudioBrand, StudioBrandPalette, StudioBrandTerm } from '../types/asset-library';
import { normalizeBrandVocabulary, validateBrandVocabulary } from './brand-vocabulary';

/** What the user authors — id/timestamps are the store's business. */
export interface StudioBrandInput {
  name: string;
  palette: StudioBrandPalette;
  fonts: { display: string; body?: string };
  logoRefs?: string[];
  styleNotes?: string;
  /** W4: names and spellings; absent or [] clears the list. */
  vocabulary?: StudioBrandTerm[];
}

const PALETTE_KEYS = ['primary', 'secondary', 'background', 'text', 'accent'] as const;

/** The six optional roles (video-10 import gap 9), in display order. */
export const OPTIONAL_PALETTE_KEYS = ['success', 'warning', 'danger', 'muted', 'surface', 'line'] as const;
export type OptionalPaletteKey = (typeof OPTIONAL_PALETTE_KEYS)[number];

/** What each optional role is for, and the `@vidtsx/kit` theme token it feeds —
 *  the one table the form, the prompts and the docs read. */
export const PALETTE_ROLE_HELP: Record<OptionalPaletteKey, { label: string; use: string; kitToken: string }> = {
  success: { label: 'Success', use: 'positive status: checkmarks, ok lines', kitToken: 'ok' },
  warning: { label: 'Warning', use: 'attention: tags, caution', kitToken: 'warn' },
  danger: { label: 'Danger', use: 'errors and destructive emphasis', kitToken: 'danger' },
  muted: { label: 'Muted text', use: 'secondary text: labels, captions', kitToken: 'muted' },
  surface: { label: 'Surface', use: 'raised panels and cards, one step off the background', kitToken: 'paper' },
  line: { label: 'Line', use: 'hairline borders and dividers', kitToken: 'line' },
};

/** The core five trimmed, plus every optional role that is a non-empty string
 *  (trimmed). An empty optional field in the form means "not set". */
export function sanitizeBrandPalette(palette: StudioBrandPalette): StudioBrandPalette {
  const out: StudioBrandPalette = {
    primary: palette.primary.trim(),
    secondary: palette.secondary.trim(),
    background: palette.background.trim(),
    text: palette.text.trim(),
    accent: palette.accent.trim(),
  };
  for (const key of OPTIONAL_PALETTE_KEYS) {
    const value = palette[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value.trim();
  }
  return out;
}

/**
 * The optional roles a palette sets, as one prompt sentence — e.g.
 * "success #22a37c (positive status: checkmarks, ok lines; kit `ok`), line …".
 * Undefined when none is set, so prompts stay exactly as before for brands
 * that never touched the extras.
 */
export function describeOptionalPaletteRoles(palette: StudioBrandPalette): string | undefined {
  const parts: string[] = [];
  for (const key of OPTIONAL_PALETTE_KEYS) {
    const value = palette[key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    const help = PALETTE_ROLE_HELP[key];
    parts.push(`${key} ${value.trim()} (${help.use}; kit \`${help.kitToken}\`)`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Bounds the verbatim prompt injection — notes are guidance, not an essay. */
export const STYLE_NOTES_MAX = 2000;

/**
 * CSS color check, deliberately lenient: hex, rgb()/hsl(), or a bare
 * keyword-looking token. Rejects strings that would break out of a CSS
 * value position in generated code (quotes, braces, newlines).
 */
export function isPlausibleCssColor(value: string): boolean {
  const v = value.trim();
  if (v === '' || v.length > 64) return false;
  if (/["'`{};\n\r\\]/.test(v)) return false;
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla)\([^()]*\)$/.test(v)) return true;
  return /^[a-zA-Z][a-zA-Z-]*$/.test(v); // keyword: 'white', 'rebeccapurple'
}

/** Validate what the user typed; returns human-readable problems ([] = ok). */
export function validateBrandInput(input: StudioBrandInput): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2) {
    errors.push('Brand name must be at least 2 characters.');
  }
  for (const key of PALETTE_KEYS) {
    const value = input.palette?.[key];
    if (typeof value !== 'string' || !isPlausibleCssColor(value)) {
      errors.push(`Palette "${key}" must be a CSS color (hex like #1a1a2e, rgb(), or a name).`);
    }
  }
  for (const key of OPTIONAL_PALETTE_KEYS) {
    const value = input.palette?.[key];
    if (value === undefined || value.trim() === '') continue; // optional: empty = not set
    if (typeof value !== 'string' || !isPlausibleCssColor(value)) {
      errors.push(`Palette "${key}" must be a CSS color, or left empty.`);
    }
  }
  if (!input.fonts?.display || input.fonts.display.trim() === '') {
    errors.push('A display font is required (Google or system family name).');
  }
  for (const font of [input.fonts?.display, input.fonts?.body]) {
    if (font !== undefined && /["'`{};\n\r\\]/.test(font)) {
      errors.push(`Font name "${font}" contains characters that are not allowed.`);
    }
  }
  for (const ref of input.logoRefs ?? []) {
    if (typeof ref !== 'string' || ref.trim() === '') {
      errors.push('Logo references must be non-empty library-relative paths.');
    }
  }
  if ((input.styleNotes ?? '').length > STYLE_NOTES_MAX) {
    errors.push(`Style notes are limited to ${STYLE_NOTES_MAX} characters.`);
  }
  errors.push(...validateBrandVocabulary(input.vocabulary));
  return errors;
}

/** Result of composing a styleNotes promotion (Q6c). */
export type StyleNotesPromotionResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'already-present' | 'displaces-not-found' | 'over-cap'; overBy?: number };

/**
 * Compose the styleNotes text a promotion would produce (Q6c) — pure, used
 * at proposal time (to show the outcome on the card) and again at accept
 * time against a fresh brand read (styleNotes may have changed since).
 * The rule appends as a `- ` line; `displaces` names an exact substring of
 * the current notes to remove first (the "what it displaces" the proposal
 * must state when the cap would otherwise overflow).
 */
export function applyStyleNotesPromotion(
  current: string | undefined,
  ruleText: string,
  displaces?: string,
): StyleNotesPromotionResult {
  let base = (current ?? '').replace(/\r\n/g, '\n');
  const rule = ruleText.trim();
  if (base.toLowerCase().includes(rule.toLowerCase())) {
    return { ok: false, reason: 'already-present' };
  }
  if (displaces !== undefined) {
    const target = displaces.replace(/\r\n/g, '\n');
    const at = base.indexOf(target);
    if (target.trim() === '' || at === -1) {
      return { ok: false, reason: 'displaces-not-found' };
    }
    base = (base.slice(0, at) + base.slice(at + target.length))
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    base = base.trim();
  }
  const next = base === '' ? `- ${rule}` : `${base}\n- ${rule}`;
  if (next.length > STYLE_NOTES_MAX) {
    return { ok: false, reason: 'over-cap', overBy: next.length - STYLE_NOTES_MAX };
  }
  return { ok: true, next };
}

/**
 * Normalize a parsed brand.json. The folder name is the id (folder-as-truth,
 * like projects). Returns null for documents too broken to use — the store
 * skips those with a warning instead of failing the whole listing.
 */
export function normalizeBrand(raw: unknown, folderId: string): StudioBrand | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Partial<StudioBrand>;
  if (typeof doc.name !== 'string' || doc.name.trim() === '') return null;
  const palette = doc.palette;
  if (!palette || typeof palette !== 'object') return null;
  for (const key of PALETTE_KEYS) {
    if (typeof palette[key] !== 'string') return null;
  }
  if (!doc.fonts || typeof doc.fonts.display !== 'string') return null;
  const now = new Date().toISOString();
  const vocabulary = normalizeBrandVocabulary(doc.vocabulary);
  const extras: Partial<StudioBrandPalette> = {};
  for (const key of OPTIONAL_PALETTE_KEYS) {
    const value = palette[key];
    if (typeof value === 'string' && value.trim() !== '') extras[key] = value.trim();
  }
  return {
    id: folderId,
    name: doc.name.trim(),
    palette: {
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      text: palette.text,
      accent: palette.accent,
      ...extras,
    },
    fonts: {
      display: doc.fonts.display,
      ...(typeof doc.fonts.body === 'string' && doc.fonts.body.trim() !== ''
        ? { body: doc.fonts.body }
        : {}),
    },
    logoRefs: Array.isArray(doc.logoRefs)
      ? doc.logoRefs.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      : [],
    ...(typeof doc.styleNotes === 'string' && doc.styleNotes.trim() !== ''
      ? { styleNotes: doc.styleNotes.slice(0, STYLE_NOTES_MAX) }
      : {}),
    ...(vocabulary.length > 0 ? { vocabulary } : {}),
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : now,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : now,
  };
}
