import type { WhiteboardProjectData } from '@shared/ipc/types';
import type {
  Asset,
  DrawableAsset,
  ImageAsset,
  RevealMode,
  Scene,
  TextAsset,
  UserImageAsset,
} from '@shared/types/whiteboard';
import { DEFAULT_SCENE_VIEWBOX } from '@shared/types/whiteboard';
import type { LibraryAsset } from '../types';

export const DEFAULT_REVEAL_DURATION_MS: Record<RevealMode, number> = {
  draw: 0, // Drawable assets compute duration from path lengths.
  wipe: 800,
  stamp: 400,
  fade: 500,
  type: 1200, // Text typewriter; getTextAssetDurationMs scales by char count.
};

// Phase 11.b gate. Local constant rather than the global feature-flags system
// (which is screen-level only). Promote to a per-user setting if needed later.
export const IS_HANDWRITING_DRAW_ENABLED = true;

// Phase 12 gate. Same rationale as IS_HANDWRITING_DRAW_ENABLED — keep the
// vectorize entry points hidden until 12.7 verification passes.
export const IS_VECTORIZE_ENABLED = true;

export interface BundledHandwritingFont {
  /** URL-segment + on-disk filename id (matches `<id>.ttf` in resources/fonts). */
  id: string;
  /** Inspector dropdown label. */
  label: string;
  /** Canonical @font-face family — matches what `<text font-family>` resolves. */
  family: string;
  /** Full CSS font-family stack including a sane fallback. */
  cssFamily: string;
  /** Resolves through the `vidtsx-font://` custom protocol (Phase 11.b.3). */
  url: string;
  script: 'latin' | 'arabic';
}

export const BUNDLED_HANDWRITING_FONTS: ReadonlyArray<BundledHandwritingFont> = [
  {
    id: 'caveat',
    label: 'Caveat',
    family: 'Caveat',
    cssFamily: 'Caveat, cursive',
    url: 'vidtsx-font://caveat',
    script: 'latin',
  },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    family: 'Patrick Hand',
    cssFamily: '"Patrick Hand", cursive',
    url: 'vidtsx-font://patrick-hand',
    script: 'latin',
  },
  {
    id: 'aref-ruqaa',
    label: 'Aref Ruqaa',
    family: 'Aref Ruqaa',
    cssFamily: '"Aref Ruqaa", serif',
    url: 'vidtsx-font://aref-ruqaa',
    script: 'arabic',
  },
  {
    id: 'reem-kufi',
    label: 'Reem Kufi',
    family: 'Reem Kufi',
    cssFamily: '"Reem Kufi", sans-serif',
    url: 'vidtsx-font://reem-kufi',
    script: 'arabic',
  },
];

let handwritingFontFacesInjected = false;
/**
 * Inject `@font-face` rules so the type/wipe/stamp/fade reveal modes (which
 * render `<text>`) can resolve the bundled handwriting families by name.
 * Idempotent. Safe to call multiple times. No-op outside the renderer.
 */
export function injectHandwritingFontFaces(): void {
  if (handwritingFontFacesInjected) return;
  if (typeof document === 'undefined') return;
  const css = BUNDLED_HANDWRITING_FONTS.map(
    (f) => `@font-face { font-family: '${f.family}'; src: url('${f.url}') format('truetype'); font-display: swap; }`
  ).join('\n');
  const styleEl = document.createElement('style');
  styleEl.dataset.vidtsxHandwritingFonts = 'true';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  handwritingFontFacesInjected = true;
}

/** Look up a bundled handwriting font by either its CSS family stack or
 *  its canonical family name. Used by the inspector to detect when the
 *  user-chosen font supports `'draw'` mode. */
export function findHandwritingFont(
  fontFamilyOrCssFamily: string
): BundledHandwritingFont | undefined {
  return BUNDLED_HANDWRITING_FONTS.find(
    (f) => f.cssFamily === fontFamilyOrCssFamily || f.family === fontFamilyOrCssFamily
  );
}

/** Compute the wall-clock draw duration for a `'draw'`-mode text asset given
 *  the sum of its extracted glyph path lengths and the scene's `pxPerSec`. */
export function getDrawModeTextDurationMs(
  totalGlyphLengthPx: number,
  pxPerSec: number
): number {
  if (pxPerSec <= 0) return 0;
  return Math.round((totalGlyphLengthPx / pxPerSec) * 1000);
}

export function getImageAssetDurationMs(asset: ImageAsset): number {
  if (typeof asset.duration === 'number' && asset.duration > 0) return asset.duration;
  return DEFAULT_REVEAL_DURATION_MS[asset.revealMode] ?? DEFAULT_REVEAL_DURATION_MS.fade;
}

export function getTextAssetDurationMs(asset: TextAsset): number {
  if (typeof asset.duration === 'number' && asset.duration > 0) return asset.duration;
  if (asset.revealMode === 'type') {
    // Scale by character count so longer strings type for longer. The 1200ms
    // default kicks in for ~24 chars; longer strings use ~50ms/char.
    return Math.max(400, asset.text.length * 50);
  }
  return DEFAULT_REVEAL_DURATION_MS[asset.revealMode] ?? DEFAULT_REVEAL_DURATION_MS.fade;
}

export function generateProjectId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function generateProjectName(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `Whiteboard ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export type AspectId = 'landscape' | 'portrait' | 'square';

export interface AspectPreset {
  id: AspectId;
  label: string;
  width: number;
  height: number;
  viewBox: string;
}

export const ASPECT_PRESETS: ReadonlyArray<AspectPreset> = [
  { id: 'landscape', label: '16:9', width: 1280, height: 720, viewBox: '0 0 1280 720' },
  { id: 'portrait', label: '9:16', width: 720, height: 1280, viewBox: '0 0 720 1280' },
  { id: 'square', label: '1:1', width: 1080, height: 1080, viewBox: '0 0 1080 1080' },
];

export function getAspectId(viewBox: string): AspectId | 'custom' {
  const match = ASPECT_PRESETS.find((p) => p.viewBox === viewBox);
  return match ? match.id : 'custom';
}

export function emptyScene(): Scene {
  return {
    assets: [],
    hand: { svg: '', tipOffset: { x: 0, y: 0 } },
    background: 'white',
    pxPerSec: 150,
    viewBox: DEFAULT_SCENE_VIEWBOX,
  };
}

function parseSceneViewBox(viewBox: string): { w: number; h: number } {
  const parts = viewBox.split(/\s+/).map((n) => Number(n));
  const w = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 1280;
  const h = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 720;
  return { w, h };
}

function parseAssetViewBox(viewBox: string): { w: number; h: number } {
  const parts = viewBox.split(/\s+/).map((n) => Number(n));
  const w = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 200;
  const h = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 200;
  return { w, h };
}

const ADD_DEFAULT_SCALE = 1.5;

export function addLibraryAssetToScene(scene: Scene, libraryAsset: LibraryAsset): Scene {
  const { w: sceneW, h: sceneH } = parseSceneViewBox(scene.viewBox);
  const { w: assetW, h: assetH } = parseAssetViewBox(libraryAsset.viewBox);
  const scale = ADD_DEFAULT_SCALE;
  const x = sceneW / 2 - (assetW * scale) / 2;
  const y = sceneH / 2 - (assetH * scale) / 2;

  const instanceId = `${libraryAsset.id}:${crypto.randomUUID().slice(0, 8)}`;
  const sceneAsset: DrawableAsset = {
    ...libraryAsset,
    id: instanceId,
    placement: { x, y, scale },
  };
  return { ...scene, assets: [...scene.assets, sceneAsset] };
}

const DEFAULT_TEXT_FONT = 'Inter, system-ui, sans-serif';
const DEFAULT_TEXT_SIZE = 48;
const DEFAULT_TEXT_WEIGHT = 500;
const DEFAULT_TEXT_COLOR = '#1a1a1a';

export function addTextAssetToScene(scene: Scene, opts?: Partial<TextAsset>): Scene {
  const { w: sceneW, h: sceneH } = parseSceneViewBox(scene.viewBox);
  const text = opts?.text ?? 'Text';
  const fontSize = opts?.fontSize ?? DEFAULT_TEXT_SIZE;
  // Rough monospace-ish estimate; the canvas re-measures at render time via
  // getBBox() so this only seeds an initial centred placement.
  const longestLine = text.split('\n').reduce((max, line) => Math.max(max, line.length), 1);
  const estimatedW = longestLine * fontSize * 0.6;
  const estimatedH = (text.split('\n').length || 1) * fontSize * 1.2;
  const scale = 1;
  const x = sceneW / 2 - (estimatedW * scale) / 2;
  const y = sceneH / 2 - (estimatedH * scale) / 2;

  const instanceId = `text-${crypto.randomUUID().slice(0, 8)}`;
  const sceneAsset: TextAsset = {
    kind: 'text',
    id: instanceId,
    text,
    fontFamily: opts?.fontFamily ?? DEFAULT_TEXT_FONT,
    fontSize,
    fontWeight: opts?.fontWeight ?? DEFAULT_TEXT_WEIGHT,
    alignment: opts?.alignment ?? 'left',
    direction: opts?.direction ?? 'auto',
    color: opts?.color ?? DEFAULT_TEXT_COLOR,
    revealMode: opts?.revealMode ?? 'fade',
    duration: opts?.duration,
    opacity: opts?.opacity,
    placement: opts?.placement ?? { x, y, scale },
  };
  return { ...scene, assets: [...scene.assets, sceneAsset] };
}

export function addImageAssetToScene(scene: Scene, userImage: UserImageAsset): Scene {
  const { w: sceneW, h: sceneH } = parseSceneViewBox(scene.viewBox);
  const scale = 1;
  const x = sceneW / 2 - (userImage.width * scale) / 2;
  const y = sceneH / 2 - (userImage.height * scale) / 2;

  const instanceId = `${userImage.id}:${crypto.randomUUID().slice(0, 8)}`;
  const sceneAsset: ImageAsset = {
    kind: 'image',
    id: instanceId,
    name: userImage.name,
    src: userImage.src,
    width: userImage.width,
    height: userImage.height,
    revealMode: 'fade',
    placement: { x, y, scale },
  };
  return { ...scene, assets: [...scene.assets, sceneAsset] };
}

export function removeAssetAt(scene: Scene, index: number): Scene {
  if (index < 0 || index >= scene.assets.length) return scene;
  const next = scene.assets.slice();
  next.splice(index, 1);
  return { ...scene, assets: next };
}

export function updateAssetAt(
  scene: Scene,
  index: number,
  patch: Partial<DrawableAsset> | Partial<ImageAsset> | Partial<TextAsset>
): Scene {
  if (index < 0 || index >= scene.assets.length) return scene;
  const next = scene.assets.slice();
  next[index] = { ...next[index], ...patch } as Asset;
  return { ...scene, assets: next };
}

function normalizeScene(scene: Scene): Scene {
  // Older rows may lack viewBox. Fill it in so downstream code can rely on it.
  if (!scene.viewBox) {
    return { ...scene, viewBox: DEFAULT_SCENE_VIEWBOX };
  }
  return scene;
}

function normalizeProject(project: WhiteboardProjectData): WhiteboardProjectData {
  return { ...project, scene: normalizeScene(project.scene) };
}

export async function fetchProjectList(): Promise<WhiteboardProjectData[]> {
  const response = await window.api.whiteboardProjectList();
  if (!response.success || !response.projects) {
    return [];
  }
  return response.projects.map(normalizeProject);
}

export async function saveProject(project: WhiteboardProjectData): Promise<void> {
  const response = await window.api.whiteboardProjectSave({ project });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to save project');
  }
}

export async function loadProject(id: string): Promise<WhiteboardProjectData> {
  const response = await window.api.whiteboardProjectLoad({ id });
  if (!response.success || !response.project) {
    throw new Error(response.error ?? 'Failed to load project');
  }
  return normalizeProject(response.project);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await window.api.whiteboardProjectDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete project');
  }
}

// Auto-inject the @font-face rules on first import of this module so the
// inspector's font dropdown + the existing wipe/stamp/fade `<text>` reveal
// modes can resolve handwriting families without an explicit init step.
// Idempotent (guarded above); no-op outside the renderer.
injectHandwritingFontFaces();
