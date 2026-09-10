import type { NodeCategory } from '@shared/types/flows';
import { CATEGORY_FILL } from './node-style';

/** The least a graph needs to be drawn: the canvas nodes (`data.toolId`) or
 *  a bundled template (`data.typeId`) both fit. */
export interface ThumbGraph {
  nodes: Array<{ id: string; position: { x: number; y: number }; data: { toolId?: string; typeId?: string } }>;
  edges: Array<{ source: string; target: string }>;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 180;
const NODE_W = 56;
const NODE_H = 22;
const PADDING = 12;

const FALLBACK_FILL = '#6b6b78';

/** Without the registry (a template tile), an input node is one whose id
 *  starts with `input`; everything else is a generator. */
function guessCategory(toolId: string): NodeCategory {
  return /^input[-_]/.test(toolId) ? 'input' : 'image';
}
const BG = '#15151a';
const GRID = '#2a2a30';
const EDGE = '#7a7a86';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(graph: ThumbGraph): Bounds | null {
  if (graph.nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of graph.nodes) {
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
    if (n.position.x > maxX) maxX = n.position.x;
    if (n.position.y > maxY) maxY = n.position.y;
  }
  // Account for node footprint so the right/bottom edges aren't clipped.
  return { minX, minY, maxX: maxX + NODE_W, maxY: maxY + NODE_H };
}

function svgEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toDataUrl(svg: string): string {
  // Use base64 rather than utf8 percent-encoding so the data URL is stable
  // regardless of the consumer (some <img> implementations choke on % in
  // image/svg+xml URLs).
  if (typeof btoa === 'function') {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }
  // Node fallback (tests, SSR) — won't typically be hit in this Electron app.
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

interface RenderOpts {
  width?: number;
  height?: number;
  /** The registry's category for a tool id; absent = guessed from the id. */
  categoryOf?: (toolId: string) => NodeCategory | undefined;
}

/**
 * Render a tiny schematic of a flow graph as an SVG data URL. Used for both
 * Flow project cards (regenerated on graph save) and template tile previews
 * in NewFlowDialog. Pure function — no DOM dependency.
 */
export function renderGraphThumbnail(graph: ThumbGraph, opts: RenderOpts = {}): string {
  const w = opts.width ?? DEFAULT_WIDTH;
  const h = opts.height ?? DEFAULT_HEIGHT;
  const bounds = computeBounds(graph);

  // Empty graph: faint grid only, no nodes.
  if (!bounds) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<rect width="${w}" height="${h}" fill="${BG}"/>` +
      gridPattern(w, h) +
      `</svg>`;
    return toDataUrl(svg);
  }

  const graphW = Math.max(1, bounds.maxX - bounds.minX);
  const graphH = Math.max(1, bounds.maxY - bounds.minY);
  const innerW = w - PADDING * 2;
  const innerH = h - PADDING * 2;
  const scale = Math.min(innerW / graphW, innerH / graphH, 1);
  // Center after scaling.
  const offsetX = PADDING + (innerW - graphW * scale) / 2 - bounds.minX * scale;
  const offsetY = PADDING + (innerH - graphH * scale) / 2 - bounds.minY * scale;

  const tx = (x: number) => x * scale + offsetX;
  const ty = (y: number) => y * scale + offsetY;
  const tw = NODE_W * scale;
  const th = NODE_H * scale;

  // Index nodes by id for edge lookup.
  const nodeById = new Map<string, { cx: number; cy: number; rightX: number; leftX: number; centerY: number }>();
  for (const node of graph.nodes) {
    const x = tx(node.position.x);
    const y = ty(node.position.y);
    nodeById.set(node.id, {
      cx: x + tw / 2,
      cy: y + th / 2,
      rightX: x + tw,
      leftX: x,
      centerY: y + th / 2,
    });
  }

  const edgePaths: string[] = [];
  for (const edge of graph.edges) {
    const s = nodeById.get(edge.source);
    const t = nodeById.get(edge.target);
    if (!s || !t) continue;
    const x1 = s.rightX;
    const y1 = s.centerY;
    const x2 = t.leftX;
    const y2 = t.centerY;
    const dx = Math.max(20 * scale, (x2 - x1) * 0.5);
    edgePaths.push(
      `<path d="M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" stroke="${EDGE}" stroke-width="${Math.max(1, 1.25 * scale)}" fill="none" opacity="0.7"/>`,
    );
  }

  const nodeRects: string[] = [];
  for (const node of graph.nodes) {
    const toolId = node.data.toolId ?? node.data.typeId ?? '';
    const category = opts.categoryOf?.(toolId) ?? guessCategory(toolId);
    const fill = toolId ? CATEGORY_FILL[category] ?? FALLBACK_FILL : FALLBACK_FILL;
    const x = tx(node.position.x);
    const y = ty(node.position.y);
    const radius = Math.max(2, 3 * scale);
    nodeRects.push(
      `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${tw.toFixed(2)}" height="${th.toFixed(2)}" rx="${radius}" ry="${radius}" fill="${fill}" opacity="0.92"/>`,
    );
    // Tiny label tint inside the node — the tool id's first letter, fades out for very small scales.
    if (toolId && scale > 0.45) {
      const text = svgEscape(toolId.replace(/^input[-_]/, '').slice(0, 1).toUpperCase());
      nodeRects.push(
        `<text x="${(x + tw / 2).toFixed(2)}" y="${(y + th / 2 + 3).toFixed(2)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.max(7, 9 * scale).toFixed(1)}" fill="white" opacity="0.85">${text}</text>`,
      );
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${BG}"/>` +
    gridPattern(w, h) +
    edgePaths.join('') +
    nodeRects.join('') +
    `</svg>`;
  return toDataUrl(svg);
}

function gridPattern(w: number, h: number): string {
  const step = 16;
  return (
    `<defs><pattern id="grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse">` +
    `<circle cx="0.5" cy="0.5" r="0.5" fill="${GRID}"/>` +
    `</pattern></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#grid)"/>`
  );
}
