// Builds the shot-specific half of the generation prompt (D8): the craft
// policy the PIPELINE model must honor, rendered into TsxPromptContext's
// extraInstructions. (The AGENT-side policy — when to reach for the tool,
// plan gates, from-scratch mode — lives in the studio-make-tsx skill; this
// file is the per-call contract with exact numbers baked in.)

import type { StudioShotKind } from '../types/studio';
import type { StudioBrand } from '../types/asset-library';
import { formatWordsBlock, type ShotAnchorWord } from './shot-words';

/** One exemplar shot (Q3a, SHOT_QUALITY_DESIGN.md): finished brand-scrubbed
 *  code injected into the prompt as the quality bar for this shot kind. */
export interface ShotExemplar {
  name: string;
  description: string;
  code: string;
}

/** One row of the asset table the model designs against (D12) — everything it
 *  may know about a ref except the URL, which only exists at render time. */
export interface ShotPromptAsset {
  /** The `assets.<key>` name the generated code must use. */
  key: string;
  kind: 'video' | 'image';
  width?: number;
  height?: number;
  durationSeconds?: number;
  description?: string;
}

/** Learned style memories (Q6a) — user-approved rules from the agent memory
 *  store, brand-filtered and budgeted by the caller (main composes; this
 *  shared module only renders). */
export interface ShotStyleMemoryInput {
  rules: string[];
  profile?: string;
}

export interface ShotPromptInput {
  kind: StudioShotKind;
  /** Timeline settings the shot must match. */
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  /** Anchor words re-based to shot-local seconds (D7), when anchored. */
  words?: ShotAnchorWord[];
  /** The project's active brand (D11) — injected as a mandatory style contract. */
  brand?: StudioBrand;
  /** Media provided to the component via the `assets` prop (D12). */
  assets?: ShotPromptAsset[];
  /** Finished exemplar shots of this kind (Q3a) — injected as the quality bar. */
  exemplars?: ShotExemplar[];
  /** The component kit (Q4): version + MANIFEST.md cited verbatim. When absent
   *  the import rule stays react+remotion only — a model without the manifest
   *  would only guess at kit names. */
  kit?: { version: string; manifest: string };
  /** Learned style rules (Q6a) — injected beside the brand contract on every
   *  generate/regenerate. Deterministic: does not depend on the agent copying
   *  rules into briefs. */
  styleMemory?: ShotStyleMemoryInput;
}

/**
 * The craft block (Q3c): taste-as-rules. Static text, deliberately placed —
 * with the exemplars — BEFORE every variable section, so the prompt prefix
 * stays cache-friendly across shots of the same kind.
 */
const CRAFT_LINES: readonly string[] = [
  '## Craft (MANDATORY design discipline)',
  '',
  '- Stagger every entrance: sibling elements arrive 0.1–0.25 s apart, never all at once.',
  '- Easing families: entrances ease-out; exits ease-in; moves and handoffs ease-in-out; overshoot ("back") only for small punctuation (a badge, a tick) — never for headlines or text blocks.',
  '- Rise-and-settle is the default entrance: fade in while translating ~20–30 px. Nothing pops unless the beat calls for it.',
  '- Spatial rhythm: pick ONE clear composition (centered stack, thirds split, or card row) and hold it. Consistent gaps; keep primary content ≥ 120 px from the frame edges.',
  '- Density ceiling: at most one headline, one support line, and one group of 3–5 items visible at once. More content means revealing in beats — or cutting it.',
  '- One accent per beat: exactly one element carries the accent color or the dominant motion at any moment; everything else settles to ink/muted.',
  '- Hold layout: reveal with opacity/transform only — text must never reflow or re-center as words or items land.',
  '- Overlays and titles exit clean: fade out over the last ~0.4 s. Cutaways may hold to the cut.',
  '- When a WORDS table is present, land reveals ON word starts — choreograph to the speech, not to arbitrary times.',
];

/** The KIT section (Q4): the pack manifest verbatim, framed with when-to-use
 *  policy. Static per app version — placed with the other static sections
 *  BEFORE everything variable, for the prompt-prefix cache. */
function buildKitLines(kit: { version: string; manifest: string }): string[] {
  return [
    `## Component kit — '@vidtsx/kit' (v${kit.version})`,
    '',
    'You MUST import from \'@vidtsx/kit\' whenever the brief calls for anything app-shaped — a browser session, a code editor, a terminal run, an AI agent working, a stats row. This section SUPERSEDES the "Allowed imports" list above: \'@vidtsx/kit\' is a first-class import for this shot. Do NOT re-implement kit components locally — declaring your own `const BrowserWindow = ...` (or TerminalWindow, VSCodeWindow, TypedText, …) when the kit exports one is a DEFECT; import the kit component and configure it with props. Hand-built chrome next to the kit\'s reads as a quality drop.',
    'A brief that DESCRIBES chrome visually ("a browser window with three dots and an address bar", "an editor", "a terminal panel") is asking for the matching kit component — build what it describes WITH the kit, never by hand. When a page-screenshot asset is provided, it belongs INSIDE BrowserWindow as a page still (`src: assets.<key>`), not floating bare.',
    'Pass the Brand palette/fonts through each component\'s `theme` prop (the kit never reads the brand itself). The manifest below is the complete API — import ONLY names it lists, exactly as documented.',
    '',
    kit.manifest.trimEnd(),
  ];
}

function buildExemplarLines(exemplars: ShotExemplar[]): string[] {
  const lines = [
    '## Exemplars — the bar to match',
    '',
    'The finished shots below set the expected level of layout, staggering and choreography for this shot kind. Match their LEVEL, never their content: your subject comes from the brief; your palette and fonts come from the Brand block when present; and your compositionConfig uses EXACTLY the literal values in the contract below — never the exemplars’ values.',
  ];
  for (const exemplar of exemplars) {
    lines.push('', `### ${exemplar.name} — ${exemplar.description}`, '', '```tsx', exemplar.code.trimEnd(), '```');
  }
  return lines;
}

const BACKGROUND_RULE: Record<StudioShotKind, string> = {
  cutaway:
    'This is a CUTAWAY shot: it fully covers the footage underneath. It MUST have an opaque full-frame background (fill the root AbsoluteFill with a solid color or gradient — never leave it transparent).',
  overlay:
    'This is an OVERLAY shot: it composites on top of playing footage. The background MUST be fully transparent — do NOT set any backgroundColor on the root; render only the elements themselves.',
  title:
    'This is a TITLE shot (a word-synced text overlay): it composites on top of playing footage. The background MUST be fully transparent — do NOT set any backgroundColor on the root; render only the text elements.',
};

export function buildShotExtraInstructions(input: ShotPromptInput): string {
  const durationInFrames = Math.round(input.durationSeconds * input.fps);
  const lines: string[] = [...CRAFT_LINES, ''];
  if (input.kit) {
    lines.push(...buildKitLines(input.kit), '');
  }
  if (input.exemplars && input.exemplars.length > 0) {
    lines.push(...buildExemplarLines(input.exemplars), '');
  }
  lines.push(
    '## Studio shot contract (MANDATORY)',
    '',
    'You are generating a SHOT — a short composition placed on a video-editor timeline, not a standalone video.',
    '',
    BACKGROUND_RULE[input.kind],
    '',
    'Export exactly this composition config, with these LITERAL values (the parser does not evaluate expressions — no arithmetic, no identifiers, no template strings):',
    '',
    '```tsx',
    'export const compositionConfig = {',
    `  id: 'shot',`,
    `  width: ${input.width},`,
    `  height: ${input.height},`,
    `  fps: ${input.fps},`,
    `  durationInFrames: ${durationInFrames}`,
    '};',
    '```',
    '',
    input.kit
      ? `- Imports: ONLY from 'react', 'remotion', and '@vidtsx/kit' (kit API per the manifest above). No other packages, no subpaths, no relative imports, everything in this single file.`
      : `- Imports: ONLY from 'react' and 'remotion'. No other packages, no relative imports, everything in this single file.`,
    '- Default-export the component.',
    `- All animation timing must be computed as seconds × fps using the fps from useVideoConfig() — never hardcode frame counts anywhere except the compositionConfig literal above. The shot is ${input.durationSeconds} seconds long.`,
    '- Do not render a progress bar, watermark, or debug text unless asked.',
  );

  if (input.brand) {
    lines.push('', ...buildBrandLines(input.brand, input.kind));
  }

  if (input.styleMemory && (input.styleMemory.rules.length > 0 || input.styleMemory.profile)) {
    lines.push('', ...buildStyleMemoryLines(input.styleMemory));
  }

  if (input.assets && input.assets.length > 0) {
    lines.push('', ...buildAssetLines(input.assets));
  }

  if (input.words && input.words.length > 0) {
    lines.push(
      '',
      '## Word timings (shot-local seconds)',
      '',
      'The shot is synced to speech. Include this EXACT constants block verbatim (keep the marker comment) and drive every word-level reveal/highlight from it, converting seconds to frames via fps:',
      '',
      '```tsx',
      formatWordsBlock(input.words),
      '```',
    );
  }

  return lines.join('\n');
}

/**
 * The brand contract (D11): palette tokens as required colors, fonts as CSS
 * family strings (the shot import lint is react+remotion only, so
 * @remotion/google-fonts is NOT available inside shots — a Google font not
 * installed on the machine falls back down the stack), style notes verbatim.
 * Logo files ride the D12 assets channel above, not the brand block.
 */
/**
 * The media contract (D12): the component gets its files through a single
 * `assets` prop — URLs minted per environment by the serializer — so the
 * generated code must never contain a path, URL, or staticFile() call.
 */
function buildAssetLines(assets: ShotPromptAsset[]): string[] {
  const describe = (a: ShotPromptAsset): string => {
    const dims = a.width && a.height ? `, ${a.width}×${a.height}` : '';
    const dur = a.durationSeconds !== undefined ? `, ${a.durationSeconds.toFixed(1)} s` : '';
    const desc = a.description ? ` — ${a.description}` : '';
    return `- \`assets.${a.key}\` (${a.kind}${dims}${dur})${desc}`;
  };
  return [
    '## Media assets (MANDATORY usage)',
    '',
    'The component receives real media files through a single `assets` prop — a map of key → URL, provided at render time. Type the component exactly like this and default-export it:',
    '',
    '```tsx',
    'const Shot: React.FC<{ assets: Record<string, string> }> = ({ assets }) => {',
    '  // ...',
    '};',
    'export default Shot;',
    '```',
    '',
    'Available assets (design the shot around them — use each one unless the brief says otherwise):',
    '',
    ...assets.map(describe),
    '',
    `- Render images with <Img src={assets.key}> and videos with <OffthreadVideo src={assets.key}> (both imported from 'remotion').`,
    '- NEVER hardcode a file path, http/data URL, or staticFile() call — the URL differs between preview and export; only the `assets` prop values are correct.',
    '- Only the keys listed above exist. Do not invent others.',
  ];
}

/**
 * The learned-style block (Q6a): rules the user has approved into the agent
 * memory store, brand-filtered and budgeted by the caller. Sits beside the
 * brand contract — style memory refines the craft/exemplar defaults (and
 * wins over them on conflict); the Brand block still owns palette and fonts.
 */
function buildStyleMemoryLines(styleMemory: ShotStyleMemoryInput): string[] {
  const lines = [
    '## Learned style (MANDATORY, user-approved)',
    '',
    'The editor has approved these standing style rules. Follow every one — they refine the Craft defaults and the exemplars above, and on any conflict with those sections the rules below win. Palette and fonts still come from the Brand block.',
  ];
  if (styleMemory.rules.length > 0) {
    lines.push('', ...styleMemory.rules.map((rule) => `- ${rule}`));
  }
  if (styleMemory.profile) {
    lines.push('', 'About this editor and their channel (context, not hard rules):', '', styleMemory.profile);
  }
  return lines;
}

function buildBrandLines(brand: StudioBrand, kind: StudioShotKind): string[] {
  const p = brand.palette;
  const fontStack = (family: string): string =>
    /\bsans-serif$|\bserif$|\bmonospace$/.test(family.trim())
      ? family
      : `'${family}', 'Segoe UI', sans-serif`;
  const lines = [
    `## Brand: ${brand.name} (MANDATORY styling)`,
    '',
    'Every color and font in this shot comes from the brand. Do not invent your own palette.',
    '',
    `- Primary: ${p.primary}`,
    `- Secondary: ${p.secondary}`,
    `- Background: ${p.background}${kind === 'cutaway' ? ' (use this for the opaque full-frame background)' : ' (reference only — this shot type keeps its background transparent)'}`,
    `- Text: ${p.text}`,
    `- Accent: ${p.accent} (use sparingly — emphasis, highlights, the current word in word-synced text)`,
    `- Display font (headings/numbers): fontFamily: "${fontStack(brand.fonts.display)}"`,
    `- Body font (labels/paragraphs): fontFamily: "${fontStack(brand.fonts.body ?? brand.fonts.display)}"`,
    '- Do NOT import any font package — set fontFamily strings exactly as given above.',
  ];
  if (brand.styleNotes) {
    lines.push('', 'Brand style notes (follow them):', brand.styleNotes);
  }
  return lines;
}
