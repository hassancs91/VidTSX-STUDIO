// What the TSX builder is asked for a Studio shot (P3 part 5, Hasan's 4a).
// Pure: the generator (shot-generator.ts) gathers the facts, this words them.
//
// Two halves, as the builder takes them:
// - the "studio-shot" PACK (static, in the system prompt): the shot craft
//   lines reworded for a builder that looks at its own frames, the shot
//   contract, and the kit manifest verbatim. The exemplars the one-shot
//   pipeline carried are dropped: the builder's looks are the quality bar.
// - the per-shot INTENT (the first message): kind + background rule, the
//   brief, the word table verbatim, learned style rules, and the media in
//   assets/ by file name. The brand goes as the request's brand text.
//
// Refine keeps today's constraints (shared/studio/shot-prompt.ts
// buildRefineInstruction) except "keep imports exactly": the builder inlines
// its libraries (Rev 2), and it renders its own frames, so no stills ride in.

import type { BuildBudget, BuildFormat, BuildPack, TsxJobStartRequest } from '../../../shared/ipc/types';
import type { StudioShotKind } from '../../../shared/types/studio';
import type { StudioBrand } from '../../../shared/types/asset-library';
import { describeOptionalPaletteRoles } from '../../../shared/studio/brand';
import { formatWordsBlock, type ShotAnchorWord } from '../../../shared/studio/shot-words';

export const STUDIO_SHOT_PACK = 'studio-shot';

const CRAFT_LINES: readonly string[] = [
  '## Shot craft',
  '',
  'Check each of these in your looks; they are what separates a finished shot from a draft.',
  '- Stagger every entrance: sibling elements arrive 0.1-0.25 s apart, never all at once.',
  '- Easing families: entrances ease out, exits ease in, moves and handoffs ease in-out. Overshoot ("back") only for small punctuation (a badge, a tick), never for headlines or text blocks.',
  '- Rise and settle is the default entrance: fade in while moving ~20-30 px. Nothing pops unless the beat calls for it.',
  '- Spatial rhythm: ONE clear composition (centred stack, thirds split or card row), held. Even gaps; primary content at least 120 px from the frame edges.',
  '- Density ceiling: at most one headline, one support line and one group of 3-5 items on screen at once. More content = reveal it in beats, or cut it.',
  '- One accent per beat: one element carries the accent colour or the main motion at any moment; the rest settles to ink or muted.',
  '- Hold layout: reveal with opacity and transform only. Text never reflows or re-centres as words or items land.',
  '- Overlays and titles exit clean: fade out over the last ~0.4 s. A cutaway may hold to the cut.',
  '- With a WORDS table, land reveals ON word starts: choreograph to the speech, not to round numbers.',
];

const CONTRACT_LINES: readonly string[] = [
  '## The Studio shot contract',
  '',
  'You are building a SHOT: a short piece placed on a video editor\'s timeline, over the footage (an overlay or a title) or instead of it for a moment (a cutaway). Not a standalone video.',
  '- compositionConfig: exactly the FORMAT in the request (width, height, fps, durationInFrames) as literal numbers. check enforces it.',
  '- The request says the background rule. A cutaway fills the whole frame with an opaque background. An overlay or a title sets NO background on its root: only its own elements are drawn, and the footage shows through everywhere else. Your looks show a transparent shot over the footage it plays over (or a checkerboard when there is none), so judge it there: contrast against the real picture, not against black.',
  '- Timing: compute every time as seconds x fps from useVideoConfig(); the only literal frame count is in compositionConfig.',
  '- Media: the files in assets/ load with staticFile(\'<file name>\'). Images, video, audio, 3D models (.glb, or .gltf with its .bin and textures), environment maps (.hdr, .exr), fonts and data files all play in a Studio shot.',
  '- A 3D overlay or title (three / React Three Fiber) keeps its canvas transparent: no scene background (no <color attach="background">, no scene.background), no <Environment background>, no opaque clear colour. The footage shows around the model.',
  '- No progress bar, watermark or debug text unless asked.',
  '- Never depict sexual or explicit content; if the brief asks for it, draw a neutral card saying the content was declined.',
];

function kitLines(kit: { version: string; manifest: string }): string[] {
  return [
    `## Component kit: '@vidtsx/kit' (v${kit.version})`,
    '',
    "When the brief calls for anything app-shaped (a browser session, a code editor, a terminal run, an AI agent at work, a stats row), import the matching component from '@vidtsx/kit' and configure it with props; do not hand-build that chrome next to it. A brief that DESCRIBES chrome (\"a browser window with an address bar\") is asking for the kit component. A page screenshot in assets/ belongs INSIDE BrowserWindow as its page. check bundles a copy of the kit into the piece.",
    "Pass the brand's colours and fonts through each component's `theme` prop (the kit never reads the brand itself). The manifest below is the complete API: import only names it lists.",
    '',
    kit.manifest.trimEnd(),
  ];
}

/** The static pack: the same text for every shot of a kit version, so the system prompt stays cache-friendly. */
export function studioShotPack(kit: { version: string; manifest: string } | null): BuildPack {
  const lines = [...CRAFT_LINES, '', ...CONTRACT_LINES];
  if (kit) lines.push('', ...kitLines(kit));
  return { name: STUDIO_SHOT_PACK, body: lines.join('\n') };
}

/** The project's frame for a shot of `durationSeconds`. Shots never loop. */
export function shotFormat(settings: { width: number; height: number; fps: number }, durationSeconds: number): BuildFormat {
  return {
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    durationInFrames: Math.max(1, Math.round(durationSeconds * settings.fps)),
  };
}

export const SHOT_BACKGROUND_RULE: Record<StudioShotKind, string> = {
  cutaway: 'A CUTAWAY: it covers the footage for its length. Fill the whole frame with an opaque background (a solid colour or a gradient on the root).',
  overlay: 'An OVERLAY: it plays on top of the footage. No background on the root: draw only the elements themselves; the footage shows through everywhere else.',
  title: 'A TITLE (word-synced text over the footage): no background on the root, only the text and what carries it; the footage shows through everywhere else.',
};

/** Whether a shot of this kind is drawn over the footage (its looks get a backdrop). */
export function isTransparentKind(kind: StudioShotKind): boolean {
  return kind !== 'cutaway';
}

/** The brand as the builder's BRAND block: palette roles, font families, style notes. */
export function brandText(brand: StudioBrand, kind: StudioShotKind): string {
  const p = brand.palette;
  const lines = [
    `${brand.name}. Every colour and font in the shot comes from it.`,
    `- Primary ${p.primary}, secondary ${p.secondary}, text ${p.text}, accent ${p.accent} (sparingly: emphasis, the current word in word-synced text).`,
    `- Background ${p.background}${kind === 'cutaway' ? ' (the cutaway\'s opaque background)' : ' (reference only: this shot keeps its background transparent)'}.`,
    `- Display font (headings, numbers): "${brand.fonts.display}". Body font: "${brand.fonts.body ?? brand.fonts.display}". Set them as fontFamily strings with a system fallback.`,
  ];
  const extras = describeOptionalPaletteRoles(p);
  if (extras) lines.push(`- Extra roles: ${extras}; pass each as the named @vidtsx/kit theme token.`);
  if (brand.styleNotes) lines.push(`- Style notes: ${brand.styleNotes}`);
  return lines.join('\n');
}

/** A media file the shot is given, as the intent lists it. */
export interface ShotMediaNote {
  /** The file's name in assets/ (`<key><ext>`). */
  file: string;
  kind: 'video' | 'image' | 'audio';
  width?: number;
  height?: number;
  durationSeconds?: number;
  description?: string;
}

function mediaLines(media: ShotMediaNote[], heading: string): string[] {
  const describe = (m: ShotMediaNote): string => {
    const dims = m.width && m.height ? `, ${m.width}x${m.height}` : '';
    const dur = m.durationSeconds !== undefined ? `, ${m.durationSeconds.toFixed(1)} s` : '';
    const how =
      m.kind === 'video'
        ? `<OffthreadVideo src={staticFile('${m.file}')} />`
        : m.kind === 'image'
          ? `<Img src={staticFile('${m.file}')} />`
          : `<Audio src={staticFile('${m.file}')} />`;
    return `- ${m.file} (${m.kind}${dims}${dur})${m.description ? `: ${m.description}` : ''}. ${how}`;
  };
  return ['', heading, ...media.map(describe)];
}

function styleLines(style: { rules: string[]; profile?: string } | undefined): string[] {
  if (!style || (style.rules.length === 0 && !style.profile)) return [];
  const lines = ['', 'LEARNED STYLE (rules the editor approved; on a conflict with the shot craft they win; the brand still owns palette and fonts):'];
  lines.push(...style.rules.map((r) => `- ${r}`));
  if (style.profile) lines.push('About this editor and their channel (context, not rules):', style.profile);
  return lines;
}

function wordsLines(words: ShotAnchorWord[] | undefined): string[] {
  if (!words?.length) return [];
  return [
    '',
    'WORDS: the shot is synced to speech. Put this EXACT constants block in your code (keep the marker comment) and drive every word-level reveal or highlight from it, converting seconds to frames with fps:',
    '```tsx',
    formatWordsBlock(words),
    '```',
  ];
}

export interface GenerateIntentInput {
  kind: StudioShotKind;
  brief: string;
  durationSeconds: number;
  words?: ShotAnchorWord[];
  style?: { rules: string[]; profile?: string };
  media?: ShotMediaNote[];
}

/** A new shot, or a fresh take of one (Regenerate). */
export function generateIntent(input: GenerateIntentInput): string {
  return [
    `STUDIO SHOT, ${input.durationSeconds.toFixed(1)} s: ${SHOT_BACKGROUND_RULE[input.kind]}`,
    '',
    `BRIEF: ${input.brief.trim()}`,
    ...wordsLines(input.words),
    ...styleLines(input.style),
    ...(input.media?.length ? mediaLines(input.media, 'MEDIA in assets/ (use each unless the brief says otherwise):') : []),
  ].join('\n');
}

const KEEP_CONTRACT = (kind: StudioShotKind): string =>
  `This is a Studio shot. Keep its compositionConfig values, any WORDS table verbatim, and its background rule: ${SHOT_BACKGROUND_RULE[kind]}`;

/** The shot's own files copied in for an edit: a shot made before the builder reads them as props.assets.<key>. */
function editMediaLines(media: ShotMediaNote[] | undefined): string[] {
  if (!media?.length) return [];
  return mediaLines(
    media,
    "The shot's media files are in assets/. Load each with staticFile('<file>') (if the code reads props.assets.<name>, switch those reads to staticFile):",
  );
}

/** An instruction from the Inspector's edit box. */
export function editIntent(input: { kind: StudioShotKind; instruction: string; media?: ShotMediaNote[] }): string {
  return [input.instruction.trim(), '', KEEP_CONTRACT(input.kind), ...editMediaLines(input.media)].join('\n');
}

/** Refine: a Quick builder edit that looks and fixes only what the frames show. */
export function refineIntent(input: {
  kind: StudioShotKind;
  brief?: string;
  styleRules?: string[];
  media?: ShotMediaNote[];
}): string {
  const lines = [
    'REFINE: look at this shot as it plays now, then fix ONLY what your frames show is wrong: layout balance, spacing and margins, type hierarchy and legibility, colour discipline, density, anything skewed, clipped, misaligned or cheap-looking. Do not redesign it: keep its concept, structure and choreography.',
    '',
    KEEP_CONTRACT(input.kind),
  ];
  if (input.brief?.trim()) lines.push('', 'The brief it was built from (the frames should serve it):', input.brief.trim());
  if (input.styleRules?.length) {
    lines.push('', 'Learned style rules (the editor approved them; they win over defaults):', ...input.styleRules.map((r) => `- ${r}`));
  }
  lines.push(...editMediaLines(input.media));
  return lines.join('\n');
}

/**
 * Convert for Studio (P3 part 8, D10): a composition written outside Studio
 * that the bundler could not make a shot. The problems are the gate's and the
 * bundler's own words; the builder's check is the same gate.
 */
export function convertIntent(input: { problems: string[]; media?: ShotMediaNote[] }): string {
  return [
    'CONVERT FOR STUDIO: this composition was written outside Studio and does not pass the Studio shot check yet:',
    ...input.problems.map((p) => `- ${p}`),
    '',
    'Make it pass check with the fewest changes. Keep its look, its timing and its compositionConfig exactly as they are (if it has none, add one that matches what it draws). Replace only what check refuses: a library that animates on its own clock becomes frame-driven code from useCurrentFrame(); a package outside the catalogue becomes a small inline equivalent or a catalogue library.',
    'Studio shots carry no synthesized audio: remove audio synthesis (tone and the like) and keep the picture.',
    ...editMediaLines(input.media),
  ].join('\n');
}

export interface ShotBuildRequestInput {
  prompt: string;
  budget: BuildBudget;
  pack: BuildPack;
  /** A new build's frame; an edit keeps its version's. */
  format?: BuildFormat;
  editOf?: { folderPath: string; version: number };
  brand?: string;
  assets?: Array<{ path: string; name: string }>;
  /** What the shot's chat.json shows for this request; default: the prompt. */
  threadText?: string;
  providerId?: string;
  model?: string;
}

export function shotBuildRequest(input: ShotBuildRequestInput): TsxJobStartRequest {
  return {
    kind: 'build',
    prompt: input.prompt,
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.model ? { options: { model: input.model } } : {}),
    build: {
      budget: input.budget,
      packs: [input.pack],
      ...(input.format ? { format: input.format } : {}),
      ...(input.editOf ? { editOf: input.editOf } : {}),
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.assets?.length ? { assets: input.assets } : {}),
      ...(input.threadText ? { threadText: input.threadText } : {}),
    },
  };
}
