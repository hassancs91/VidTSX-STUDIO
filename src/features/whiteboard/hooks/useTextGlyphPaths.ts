import { useEffect, useMemo, useState } from 'react';
import type { Asset, TextAsset } from '../types';
import { isTextAsset } from '../types';
import {
  IS_HANDWRITING_DRAW_ENABLED,
  findHandwritingFont,
} from '../services/whiteboard-service';
import { extractGlyphPaths } from '../services/text-glyph-extractor';

export interface GlyphCacheEntry {
  paths: string[];
  viewBox: string;
  /** Sum of `getTotalLength()` across all extracted paths. Used to compute
   *  draw-mode wall-clock duration via `getDrawModeTextDurationMs`. */
  totalLengthPx: number;
}

export type GlyphCacheStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: GlyphCacheEntry }
  | { status: 'error'; error: string };

const cache = new Map<string, GlyphCacheEntry>();
const inFlight = new Map<string, Promise<GlyphCacheEntry>>();

function makeKey(asset: TextAsset): string {
  return `${asset.fontSize}|${asset.direction}|${asset.fontFamily}|${asset.text}`;
}

let measureSvg: SVGSVGElement | null = null;
let measurePath: SVGPathElement | null = null;

/** Lazily mount a hidden offscreen SVG/path used to call `getTotalLength()`
 *  for each extracted `d` string. The single shared element is reused — no
 *  per-call DOM churn. */
function ensureMeasureNodes(): { svg: SVGSVGElement; path: SVGPathElement } | null {
  if (typeof document === 'undefined') return null;
  if (!measureSvg) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';
    svg.style.pointerEvents = 'none';
    const path = document.createElementNS(ns, 'path');
    svg.appendChild(path);
    document.body.appendChild(svg);
    measureSvg = svg;
    measurePath = path;
  }
  return { svg: measureSvg!, path: measurePath! };
}

function measureTotalLength(paths: string[]): number {
  const nodes = ensureMeasureNodes();
  if (!nodes) return 0;
  let sum = 0;
  for (const d of paths) {
    nodes.path.setAttribute('d', d);
    try {
      sum += nodes.path.getTotalLength();
    } catch {
      // Malformed `d` shouldn't happen with opentype.js output, but fail soft.
    }
  }
  return sum;
}

/** Synchronous cache lookup for callers outside React (e.g. thumbnail render).
 *  Returns `null` when the asset's glyphs haven't been extracted yet — the
 *  caller should fall back to a `<text>` rendering. Doesn't trigger a load. */
export function getCachedGlyphsForAsset(asset: TextAsset): GlyphCacheEntry | null {
  if (!IS_HANDWRITING_DRAW_ENABLED) return null;
  if (asset.revealMode !== 'draw') return null;
  const handwriting = findHandwritingFont(asset.fontFamily);
  if (!handwriting) return null;
  return cache.get(makeKey(asset)) ?? null;
}

async function loadGlyphs(
  asset: TextAsset,
  fontUrl: string,
  key: string
): Promise<GlyphCacheEntry> {
  const cached = cache.get(key);
  if (cached) return cached;
  const inFlightPromise = inFlight.get(key);
  if (inFlightPromise) return inFlightPromise;

  const promise = (async () => {
    const { paths, viewBox } = await extractGlyphPaths({
      text: asset.text,
      fontUrl,
      fontSize: asset.fontSize,
      direction: asset.direction,
    });
    const totalLengthPx = measureTotalLength(paths);
    const entry: GlyphCacheEntry = { paths, viewBox, totalLengthPx };
    cache.set(key, entry);
    return entry;
  })();
  inFlight.set(key, promise);
  // Whether resolved or rejected, drop the in-flight slot so the next caller
  // either reads the cache or retries cleanly.
  promise.finally(() => inFlight.delete(key));
  return promise;
}

/**
 * Resolve the extracted glyph paths + viewBox + total stroke length for a
 * text asset. Stays `idle` unless the asset is in `'draw'` mode AND its
 * `fontFamily` resolves to a bundled handwriting font (Phase 11.b). Cache is
 * keyed by content/font/size/direction — editing colour or opacity does not
 * invalidate.
 */
export function useTextGlyphPaths(asset: TextAsset): GlyphCacheStatus {
  const isDrawMode = asset.revealMode === 'draw';
  const handwriting = findHandwritingFont(asset.fontFamily);
  const enabled = IS_HANDWRITING_DRAW_ENABLED && isDrawMode && !!handwriting;
  const key = enabled ? makeKey(asset) : null;

  const initial: GlyphCacheStatus =
    key && cache.has(key) ? { status: 'ready', data: cache.get(key)! } : { status: 'idle' };
  const [state, setState] = useState<GlyphCacheStatus>(initial);

  useEffect(() => {
    if (!key || !handwriting) {
      setState({ status: 'idle' });
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'ready', data: cached });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    loadGlyphs(asset, handwriting.url, key).then(
      (entry) => {
        if (!cancelled) setState({ status: 'ready', data: entry });
      },
      (err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key, handwriting?.url, asset]);

  return state;
}

/**
 * Resolve glyph caches for every draw-mode text asset in a scene at once.
 * Returns a `Map<assetId, GlyphCacheEntry>` containing only entries for
 * assets whose extraction has resolved. Cold entries are absent (the editor's
 * `flatPaths` memo treats their absence as "fall back to placeholder spec").
 *
 * Implemented as a single hook (not per-asset) so the editor can drive a
 * dynamic asset list without tripping rules-of-hooks.
 */
export function useSceneGlyphPaths(assets: Asset[]): Map<string, GlyphCacheEntry> {
  const [version, setVersion] = useState(0);

  const drawTextSpecs = useMemo(() => {
    if (!IS_HANDWRITING_DRAW_ENABLED) return [];
    const out: Array<{
      assetId: string;
      key: string;
      fontUrl: string;
      asset: TextAsset;
    }> = [];
    for (const asset of assets) {
      if (!isTextAsset(asset) || asset.revealMode !== 'draw') continue;
      const handwriting = findHandwritingFont(asset.fontFamily);
      if (!handwriting) continue;
      out.push({
        assetId: asset.id,
        key: makeKey(asset),
        fontUrl: handwriting.url,
        asset,
      });
    }
    return out;
  }, [assets]);

  // Stable digest so the load-trigger effect only re-runs when the SET of
  // draw-mode text assets or their cache keys actually changes — not every
  // time the parent re-renders.
  const specDigest = drawTextSpecs.map((s) => `${s.assetId}@${s.key}`).join('\n');

  useEffect(() => {
    let cancelled = false;
    for (const spec of drawTextSpecs) {
      if (cache.has(spec.key)) continue;
      loadGlyphs(spec.asset, spec.fontUrl, spec.key).then(
        () => {
          if (!cancelled) setVersion((v) => v + 1);
        },
        () => {
          // Errors leave the entry absent; the placeholder spec keeps the
          // timeline alive and a future asset edit can retry.
        }
      );
    }
    return () => {
      cancelled = true;
    };
    // drawTextSpecs is recreated each render but specDigest is the load-bearing
    // identity — including drawTextSpecs in deps would re-fire unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specDigest]);

  return useMemo(() => {
    const map = new Map<string, GlyphCacheEntry>();
    for (const spec of drawTextSpecs) {
      const entry = cache.get(spec.key);
      if (entry) map.set(spec.assetId, entry);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specDigest, version]);
}
