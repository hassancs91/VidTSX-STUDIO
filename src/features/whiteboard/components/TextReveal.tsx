import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { TextAlignment, TextAsset, TextDirection } from '../types';

export interface TextRevealHandle {
  /** Push a per-frame progress in 0..1 (clamped). Writes inline style on a
   *  wrapper `<g>` ref via DOM, no React re-render. */
  setProgress: (progress: number) => void;
}

interface MeasuredBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  asset: TextAsset;
  /** When false, the component renders nothing. */
  visible: boolean;
  /** When true, render the text fully revealed via JSX (preview / show-all
   *  mode) and skip the imperative `<g ref={groupRef}>` subtree entirely. */
  staticReveal?: boolean;
  /** Callback invoked once the text element measures its bbox via getBBox().
   *  Re-fires when text content or typography props change. The canvas uses
   *  this to size the click-target rect and the dashed selection outline. */
  onMeasure?: (bbox: MeasuredBbox) => void;
  /** Phase 11.b — draw mode. When `revealMode === 'draw'` and glyph extraction
   *  has resolved, the canvas passes the cached `{ paths, viewBox }` here so
   *  this component renders one `<path>` per glyph instead of `<text>`. */
  glyphPaths?: { paths: string[]; viewBox: string } | null;
  /** Phase 11.b — draw mode. Per-glyph ref hook so the parent canvas can
   *  collect each `<path>` into the flat `pathsRef` driven by `usePathAnimator`. */
  onRegisterPath?: (localIndex: number, el: SVGPathElement | null) => void;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function stampScale(progress: number): number {
  if (progress < 0.1) return 0;
  if (progress < 0.7) {
    const t = (progress - 0.1) / 0.6;
    return 0.5 + (1.1 - 0.5) * easeOutCubic(t);
  }
  const t = (progress - 0.7) / 0.3;
  return 1.1 + (1.0 - 1.1) * t;
}

function alignmentToAnchor(alignment: TextAlignment): 'start' | 'middle' | 'end' {
  if (alignment === 'center') return 'middle';
  if (alignment === 'right') return 'end';
  return 'start';
}

/** Whether the rendered text reads RTL. 'auto' defers to the browser; we
 *  treat it as LTR for clip-direction purposes since we can't introspect
 *  per-character bidi without extra work. */
function isRtl(direction: TextDirection): boolean {
  return direction === 'rtl';
}

interface TextLinesProps {
  asset: TextAsset;
  textRef?: (el: SVGTextElement | null) => void;
}

function TextLines({ asset, textRef }: TextLinesProps) {
  const lines = asset.text.split('\n');
  const lineHeightEm = 1.2;
  return (
    <text
      ref={textRef}
      x={0}
      y={0}
      fill={asset.color}
      fontFamily={asset.fontFamily}
      fontSize={asset.fontSize}
      fontWeight={asset.fontWeight}
      textAnchor={alignmentToAnchor(asset.alignment)}
      direction={asset.direction === 'auto' ? undefined : asset.direction}
      dominantBaseline="hanging"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={0} dy={i === 0 ? 0 : `${lineHeightEm}em`}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
}

export const TextReveal = forwardRef<TextRevealHandle, Props>(function TextReveal(
  { asset, visible, staticReveal, onMeasure, glyphPaths, onRegisterPath },
  ref
) {
  const groupRef = useRef<SVGGElement | null>(null);
  const textRef = useRef<SVGTextElement | null>(null);
  const userOpacity = asset.opacity ?? 1;

  // Re-measure whenever any property that affects glyph layout changes.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    try {
      const b = el.getBBox();
      onMeasure?.({ x: b.x, y: b.y, w: b.width, h: b.height });
    } catch {
      // getBBox() can throw on a not-yet-laid-out element; bail and let
      // the effect retry on the next prop change.
    }
  }, [
    asset.text,
    asset.fontFamily,
    asset.fontSize,
    asset.fontWeight,
    asset.alignment,
    asset.direction,
    onMeasure,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      setProgress(progress: number) {
        const g = groupRef.current;
        if (!g) return;
        const p = clamp01(progress);
        const style = g.style;
        switch (asset.revealMode) {
          case 'wipe': {
            g.setAttribute('opacity', userOpacity.toString());
            style.clipPath = isRtl(asset.direction)
              ? `inset(0 0 0 ${(1 - p) * 100}%)`
              : `inset(0 ${(1 - p) * 100}% 0 0)`;
            style.transform = '';
            break;
          }
          case 'stamp': {
            const isVisible = p > 0.05;
            g.setAttribute('opacity', isVisible ? userOpacity.toString() : '0');
            style.clipPath = '';
            style.transformBox = 'fill-box';
            style.transformOrigin = 'center';
            style.transform = `scale(${stampScale(p).toFixed(3)})`;
            break;
          }
          case 'type': {
            // Reveal a substring left-to-right (or right-to-left for RTL).
            // Clip per character count so multi-line text reveals together.
            g.setAttribute('opacity', userOpacity.toString());
            const totalChars = Math.max(1, asset.text.length);
            const visibleChars = Math.ceil(p * totalChars);
            const ratio = visibleChars / totalChars;
            const insetPct = (1 - ratio) * 100;
            style.clipPath = isRtl(asset.direction)
              ? `inset(0 0 0 ${insetPct}%)`
              : `inset(0 ${insetPct}% 0 0)`;
            style.transform = '';
            break;
          }
          case 'draw': {
            // Phase 11.b — parent animator drives dashoffset on extracted
            // glyph paths directly. No per-frame work here.
            break;
          }
          case 'fade':
          default: {
            g.setAttribute('opacity', (userOpacity * easeOutCubic(p)).toString());
            style.clipPath = '';
            style.transform = '';
            break;
          }
        }
      },
    }),
    [asset.revealMode, asset.direction, asset.text.length, userOpacity]
  );

  // Phase 11.b — draw mode emits its measure from the cached glyph viewBox
  // (the `<text>` getBBox() pathway above doesn't apply when we render
  // `<path>` glyphs instead of `<text>`).
  useEffect(() => {
    if (asset.revealMode !== 'draw') return;
    if (!glyphPaths) return;
    const parts = glyphPaths.viewBox.split(/\s+/).map(Number);
    const w = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 0;
    const h = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 0;
    onMeasure?.({ x: 0, y: 0, w, h });
  }, [asset.revealMode, glyphPaths, onMeasure]);

  if (!visible) return null;

  // Phase 11.b — draw mode renders extracted glyph paths instead of `<text>`.
  // Until the cache resolves we render nothing (the editor's flatPaths memo
  // contributes a placeholder duration so the timeline doesn't stall).
  if (asset.revealMode === 'draw') {
    if (!glyphPaths) return null;
    const strokeWidth = Math.max(2, asset.fontSize * 0.05);
    if (staticReveal) {
      return (
        <g style={{ opacity: userOpacity }}>
          {glyphPaths.paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={asset.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    }
    // Initial dash values force "fully hidden" before usePathAnimator's mount
    // effect overwrites them with the measured length. 100000 is larger than
    // any plausible glyph perimeter so the path stays invisible the first frame.
    return (
      <g style={{ opacity: userOpacity }}>
        {glyphPaths.paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={asset.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={100000}
            strokeDashoffset={100000}
            ref={(el) => onRegisterPath?.(i, el)}
          />
        ))}
      </g>
    );
  }

  if (staticReveal) {
    return (
      <g style={{ opacity: userOpacity }}>
        <TextLines asset={asset} textRef={(el) => (textRef.current = el)} />
      </g>
    );
  }

  return (
    <g ref={groupRef} opacity={0}>
      <TextLines asset={asset} textRef={(el) => (textRef.current = el)} />
    </g>
  );
});
