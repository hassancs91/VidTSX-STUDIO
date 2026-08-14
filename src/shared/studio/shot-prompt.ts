// Builds the shot-specific half of the generation prompt (D8): the craft
// policy the PIPELINE model must honor, rendered into TsxPromptContext's
// extraInstructions. (The AGENT-side policy — when to reach for the tool,
// plan gates, from-scratch mode — lives in the studio-make-tsx skill; this
// file is the per-call contract with exact numbers baked in.)

import type { StudioShotKind } from '../types/studio';
import type { StudioBrand } from '../types/asset-library';
import { formatWordsBlock, type ShotAnchorWord } from './shot-words';

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
  const lines: string[] = [
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
    `- Imports: ONLY from 'react' and 'remotion'. No other packages, no relative imports, everything in this single file.`,
    '- Default-export the component.',
    `- All animation timing must be computed as seconds × fps using the fps from useVideoConfig() — never hardcode frame counts anywhere except the compositionConfig literal above. The shot is ${input.durationSeconds} seconds long.`,
    '- Do not render a progress bar, watermark, or debug text unless asked.',
  ];

  if (input.brand) {
    lines.push('', ...buildBrandLines(input.brand, input.kind));
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
