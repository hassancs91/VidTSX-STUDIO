/**
 * Phase 12 — raster → SVG vectorization via vtracer-wasm. Decodes a raster
 * blob through an off-screen `<canvas>`, hands the RGBA bytes to the wasm
 * tracer, then funnels the result through the existing Phase 9 SVG normalizer
 * so the output drops straight into a `UserSvgAsset`.
 */
import init, { to_svg } from 'vtracer-wasm';
// Vite's `?url` suffix gives us a real asset URL the dev server actually
// serves; without this, the package-relative wasm path falls through to the
// SPA fallback and `init()` chokes on `<!DOCTYPE html>` instead of magic
// bytes. Required in dev and build alike.
import vtracerWasmUrl from 'vtracer-wasm/vtracer.wasm?url';
import { normalizeSvgElement } from './svg-parser';

export interface VectorizeConfig {
  /** B&W trace by default. `'color'` is reserved for a later iteration. */
  mode?: 'binary' | 'color';
  /** Maps to VTracer's `color_precision`. Higher = more detail. 1..8, default 6. */
  threshold?: number;
  /** Drops connected pixel groups smaller than this. 1..128, default 8. */
  filterSpeckle?: number;
}

export interface VectorizeResult {
  paths: string[];
  viewBox: string;
}

let initPromise: Promise<unknown> | null = null;

/** Single-flight wasm initialiser. Concurrent vectorize calls share one init. */
function ensureWasm(): Promise<unknown> {
  if (!initPromise) initPromise = init({ module_or_path: vtracerWasmUrl });
  return initPromise;
}

interface DecodedRaster {
  pixels: Uint8Array;
  width: number;
  height: number;
}

async function decodeRasterBytes(bytes: Uint8Array): Promise<DecodedRaster> {
  if (typeof document === 'undefined') {
    throw new Error('Vectorize requires a DOM (renderer-only).');
  }
  const blob = new Blob([new Uint8Array(bytes)]);
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D context for decode');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    pixels: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    width,
    height,
  };
}

function buildVtracerConfig(config: VectorizeConfig | undefined): Record<string, unknown> {
  // The vtracer-wasm fork's actual struct (extracted from the wasm string
  // table — declaration order):
  //   { binary, mode, hierarchical, cornerThreshold, lengthThreshold,
  //     maxIterations, spliceThreshold, filterSpeckle, colorPrecision,
  //     layerDifference, pathPrecision }
  // `binary: bool` replaces upstream's `color_mode: ColorMode`. Missing the
  // field makes serde-wasm-bindgen reject the input and the wasm traps
  // (`unreachable`). Defaults below mirror upstream VTracer's CLI defaults.
  const threshold = clamp(config?.threshold ?? 6, 1, 8);
  const filterSpeckle = clamp(config?.filterSpeckle ?? 8, 1, 128);
  return {
    binary: config?.mode !== 'color',
    mode: 'spline',
    hierarchical: 'cutout',
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    filterSpeckle,
    colorPrecision: threshold,
    layerDifference: 16,
    pathPrecision: 5,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Trace `bytes` (PNG/JPG/WebP) into a flat SVG path list + viewBox using the
 * existing svg-parser pipeline. The intermediate VTracer SVG string is parsed
 * via `DOMParser` so we benefit from the same normalisation user-uploaded SVGs
 * already go through (transform-flattening, primitive→path conversion, etc.).
 */
export async function vectorizeRaster(
  bytes: Uint8Array,
  config?: VectorizeConfig
): Promise<VectorizeResult> {
  await ensureWasm();
  const { pixels, width, height } = await decodeRasterBytes(bytes);
  const svgString = to_svg(pixels, width, height, buildVtracerConfig(config));
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Vectorizer produced unparseable SVG');
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('Vectorizer output missing root <svg>');
  }
  return normalizeSvgElement(root as unknown as SVGSVGElement);
}
