// Intrinsic size of an SVG from its root element — ffprobe cannot read SVG
// (Remotion's ffmpeg has no rasterizer), so Studio's media import reads the
// `width`/`height` attributes, falling back to the `viewBox`. Pure text parsing;
// never evaluates the document.

export interface SvgDimensions {
  width?: number;
  height?: number;
}

/** A length attribute: unitless or px numbers only. Percentages and other
 *  units depend on a viewport the file does not have, so they read as unknown. */
function parseLength(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(value);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match ? (match[1] ?? match[2]) : undefined;
}

/**
 * Width and height from the first `<svg …>` tag. Attributes win; a viewBox
 * supplies whichever side is missing (or both). Either side may stay
 * undefined when the file gives no usable number.
 */
export function parseSvgDimensions(svgText: string): SvgDimensions {
  const open = /<svg\b[^>]*>/i.exec(svgText);
  if (!open) return {};
  const tag = open[0];
  let width = parseLength(attr(tag, 'width'));
  let height = parseLength(attr(tag, 'height'));
  if (width === undefined || height === undefined) {
    const viewBox = attr(tag, 'viewBox');
    const parts = viewBox?.trim().split(/[\s,]+/).map(Number) ?? [];
    if (parts.length === 4 && parts.every((p) => Number.isFinite(p)) && parts[2] > 0 && parts[3] > 0) {
      width ??= Math.round(parts[2]);
      height ??= Math.round(parts[3]);
    }
  }
  return { width, height };
}
