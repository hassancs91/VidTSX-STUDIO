import * as opentype from 'opentype.js';
import type { TextDirection } from '@shared/types/whiteboard';

// KNOWN LIMITATION (Phase 11.b): Arabic letters render in their isolated form,
// not visually joined. opentype.js does not implement OpenType GSUB shaping;
// substituting base letters with Presentation Forms (FB50+/FE70+) doesn't
// help either because the bundled Aref Ruqaa / Reem Kufi fonts don't expose
// those codepoints in their cmap — they expect proper OT shaping at runtime.
// A follow-up phase will integrate harfbuzzjs to apply GSUB lookups; for now
// Arabic is readable but not cursively joined.

interface ExtractInput {
  text: string;
  fontUrl: string;
  fontSize: number;
  direction: TextDirection;
}

export interface ExtractedGlyphs {
  paths: string[];
  viewBox: string;
}

const LINE_HEIGHT_EM = 1.2;

const fontCache = new Map<string, Promise<opentype.Font>>();

async function loadFont(fontUrl: string): Promise<opentype.Font> {
  const cached = fontCache.get(fontUrl);
  if (cached) return cached;

  // Fetch + parse manually rather than calling opentype.load(url) so the custom
  // `vidtsx-font://` protocol works the same as any other fetchable URL — the
  // renderer's fetch supports our registered protocols, but opentype.load may
  // route through XHR in some environments.
  const promise = (async () => {
    let response: Response;
    try {
      response = await fetch(fontUrl);
    } catch (err) {
      throw new Error(
        `Font load failed: ${fontUrl} (${err instanceof Error ? err.message : 'fetch error'})`
      );
    }
    if (!response.ok) {
      throw new Error(`Font load failed: ${fontUrl} (HTTP ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    try {
      return opentype.parse(buffer);
    } catch (err) {
      throw new Error(
        `Font load failed: ${fontUrl} (${err instanceof Error ? err.message : 'parse error'})`
      );
    }
  })();
  fontCache.set(fontUrl, promise);
  // If the load fails, evict so a retry can re-fetch.
  promise.catch(() => fontCache.delete(fontUrl));
  return promise;
}

interface ShapedGlyph {
  glyph: opentype.Glyph;
  /** Advance in pixel units (already scaled by fontSize / unitsPerEm). */
  advancePx: number;
}

function shapeLine(font: opentype.Font, line: string, fontSize: number): ShapedGlyph[] {
  const scale = fontSize / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(line);
  return glyphs.map((glyph) => ({
    glyph,
    advancePx: (glyph.advanceWidth ?? 0) * scale,
  }));
}

/**
 * Extract per-glyph SVG `d` strings from `text` using the bundled font at
 * `fontUrl`. Output paths are pre-positioned in the returned coordinate space:
 * the canvas can render them as-is inside an SVG with the returned viewBox.
 *
 * Multi-line input (`\n`-separated) lays out one line per row at `fontSize *
 * 1.2` line height. RTL lines right-align to `viewBox.width` so the visually
 * rightmost glyph is the first logical character — the animator then draws
 * glyphs in logical order, which visually progresses leftward exactly the way
 * Arabic is hand-written.
 */
export async function extractGlyphPaths(input: ExtractInput): Promise<ExtractedGlyphs> {
  const { text, fontUrl, fontSize, direction } = input;
  const font = await loadFont(fontUrl);

  const lines = text.split('\n');
  const lineHeight = fontSize * LINE_HEIGHT_EM;
  const isRtl = direction === 'rtl';

  // Pass 1: shape each line and record its width so we can right-align RTL.
  const shapedLines: ShapedGlyph[][] = lines.map((line) => shapeLine(font, line, fontSize));
  const lineWidths = shapedLines.map((shaped) =>
    shaped.reduce((sum, s) => sum + s.advancePx, 0)
  );
  const maxLineWidth = Math.max(0, ...lineWidths);

  // Pass 2: emit per-glyph path strings positioned in the final coord space.
  // opentype.js's `getPath(x, y, fontSize)` treats x as the LEFT edge of the
  // glyph's advance box and y as the baseline.
  //
  //  - LTR: walk left-to-right. The first logical glyph lands at x=0 (or the
  //    left of the right-aligned line — but LTR is always left-aligned here).
  //  - RTL: walk right-to-left so the first LOGICAL glyph (visually rightmost,
  //    e.g. م in "مرحبا") lands flush against the right edge. Subsequent
  //    glyphs step leftward. The animator then draws paths in array order,
  //    which visually progresses leftward exactly the way Arabic is
  //    hand-written.
  //
  // Baseline y. opentype.js places the baseline at y; we offset by the
  // ascender so descenders + tall letters stay inside the viewBox.
  const paths: string[] = [];
  const ascenderPx = (font.ascender / font.unitsPerEm) * fontSize;
  for (let lineIdx = 0; lineIdx < shapedLines.length; lineIdx++) {
    const shaped = shapedLines[lineIdx];
    const y = lineIdx * lineHeight + ascenderPx;
    // RTL: cursor starts at the right edge of the (right-aligned) line and
    // moves leftward by each glyph's advance — we subtract BEFORE drawing so
    // the box's right edge lands at maxLineWidth on the first iteration.
    // LTR: cursor starts at 0 and moves rightward AFTER drawing.
    let x = isRtl ? maxLineWidth : 0;
    for (const { glyph, advancePx } of shaped) {
      if (isRtl) {
        x -= advancePx;
      }
      // Some glyphs (whitespace, controls, .notdef) emit no path data; skip them.
      const d = glyph.getPath(x, y, fontSize).toPathData(2);
      if (d && d.length > 0) {
        paths.push(d);
      }
      if (!isRtl) {
        x += advancePx;
      }
    }
  }

  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const width = Math.max(1, maxLineWidth);
  const viewBox = `0 0 ${width.toFixed(2)} ${totalHeight.toFixed(2)}`;

  return { paths, viewBox };
}

/** Test-only escape hatch to clear the in-memory font cache. */
export function _clearFontCache(): void {
  fontCache.clear();
}
