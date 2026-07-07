import type {
  Asset,
  DrawableAsset,
  Scene,
  TextAsset,
  WhiteboardBackground,
} from '@shared/types/whiteboard';
import {
  DEFAULT_PLACEMENT,
  isDrawableAsset,
  isTextAsset,
} from '@shared/types/whiteboard';
import { getCachedGlyphsForAsset } from '../hooks/useTextGlyphPaths';

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;
const RULE_SPACING = 24;
const RULE_STROKE = '#e5e7eb';

const BG_FILL: Record<WhiteboardBackground, string> = {
  white: '#ffffff',
  lined: '#ffffff',
  grid: '#ffffff',
  chalkboard: '#1f2937',
};

const DEFAULT_STROKE: Record<WhiteboardBackground, string> = {
  white: '#1a1a1a',
  lined: '#1a1a1a',
  grid: '#1a1a1a',
  chalkboard: '#f9fafb',
};

function parseViewBox(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = viewBox.split(/\s+/).map((n) => Number(n));
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    w: Number.isFinite(w) && w > 0 ? w : 1280,
    h: Number.isFinite(h) && h > 0 ? h : 720,
  };
}

function buildBackgroundSvg(scene: Scene): string {
  const { x, y, w, h } = parseViewBox(scene.viewBox);
  const fill = BG_FILL[scene.background];
  let lines = '';
  if (scene.background === 'lined' || scene.background === 'grid') {
    for (let yy = y + RULE_SPACING; yy < y + h; yy += RULE_SPACING) {
      lines += `<line x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="${RULE_STROKE}" stroke-width="1" />`;
    }
  }
  if (scene.background === 'grid') {
    for (let xx = x + RULE_SPACING; xx < x + w; xx += RULE_SPACING) {
      lines += `<line x1="${xx}" y1="${y}" x2="${xx}" y2="${y + h}" stroke="${RULE_STROKE}" stroke-width="1" />`;
    }
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" />${lines}`;
}

function buildDrawableSvg(asset: DrawableAsset, defaultStroke: string): string {
  const placement = asset.placement ?? DEFAULT_PLACEMENT;
  const stroke = asset.strokeColor ?? defaultStroke;
  const strokeWidth = asset.strokeWidth ?? 2;
  const transform = `translate(${placement.x} ${placement.y}) scale(${placement.scale})`;
  const paths = asset.paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('');
  return `<g transform="${transform}">${paths}</g>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function alignmentToAnchor(alignment: TextAsset['alignment']): string {
  if (alignment === 'center') return 'middle';
  if (alignment === 'right') return 'end';
  return 'start';
}

function buildTextSvg(asset: TextAsset): string {
  const placement = asset.placement ?? DEFAULT_PLACEMENT;
  const transform = `translate(${placement.x} ${placement.y}) scale(${placement.scale})`;
  const opacity = asset.opacity ?? 1;
  // Phase 11.b — draw-mode text: if glyph extraction has resolved, render
  // the static `<path>` glyphs (no font dependency in the rasterizer). Else
  // fall back to `<text>`, which the off-screen Image() loader will render
  // with a fallback font (the bundled handwriting fonts can't be fetched
  // through the sandboxed loader, mirroring the image-asset limitation).
  const cachedGlyphs = getCachedGlyphsForAsset(asset);
  if (cachedGlyphs) {
    const stroke = asset.color;
    const strokeWidth = Math.max(2, asset.fontSize * 0.05);
    const paths = cachedGlyphs.paths
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
      )
      .join('');
    return `<g transform="${transform}" opacity="${opacity}">${paths}</g>`;
  }
  const lines = asset.text.split('\n');
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="0" dy="${i === 0 ? 0 : '1.2em'}">${escapeXml(line || ' ')}</tspan>`
    )
    .join('');
  const dirAttr =
    asset.direction === 'auto' ? '' : ` direction="${asset.direction}"`;
  const fontFamily = escapeXml(asset.fontFamily);
  return `<g transform="${transform}"><text x="0" y="0" fill="${asset.color}" font-family="${fontFamily}" font-size="${asset.fontSize}" font-weight="${asset.fontWeight}" text-anchor="${alignmentToAnchor(asset.alignment)}" dominant-baseline="hanging"${dirAttr} opacity="${opacity}">${tspans}</text></g>`;
}

function buildAssetSvg(asset: Asset, defaultStroke: string): string | null {
  if (isDrawableAsset(asset)) return buildDrawableSvg(asset, defaultStroke);
  if (isTextAsset(asset)) return buildTextSvg(asset);
  // Image assets aren't rasterised in thumbnails: the SVG is loaded into an
  // off-screen Image() which can't fetch vidtsx-image:// resources from the
  // sandboxed loader. Drawable + text-only thumbs are acceptable for now.
  return null;
}

function buildSceneSvg(scene: Scene): string {
  const defaultStroke = DEFAULT_STROKE[scene.background];
  const bg = buildBackgroundSvg(scene);
  const body = scene.assets
    .map((a) => buildAssetSvg(a, defaultStroke))
    .filter((s): s is string => s !== null)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" viewBox="${scene.viewBox}" preserveAspectRatio="xMidYMid meet">${bg}${body}</svg>`;
}

export async function generateSceneThumbnail(scene: Scene): Promise<string> {
  if (scene.assets.length === 0) return '';

  const svg = buildSceneSvg(scene);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to rasterize thumbnail SVG'));
      i.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = BG_FILL[scene.background];
    ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    ctx.drawImage(img, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    return canvas.toDataURL('image/png');
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}
