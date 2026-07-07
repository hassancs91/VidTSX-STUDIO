import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ImageAsset } from '../types';

export interface ImageRevealHandle {
  /** Push a per-frame progress in 0..1 (clamped). Writes inline style on a
   *  wrapper `<g>` ref via DOM, no React re-render. */
  setProgress: (progress: number) => void;
}

interface Props {
  asset: ImageAsset;
  /** When false, the component renders nothing. */
  visible: boolean;
  /** When true, render the image fully revealed via JSX (preview / show-all
   *  mode) and skip the imperative `<g ref={groupRef}>` subtree entirely.
   *  Inspector opacity edits propagate live via React; the imperative handle
   *  no-ops because `groupRef.current` is null in this branch. */
  staticReveal?: boolean;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Stamp reveal: invisible until progress > ~0.1, then a brief overshoot from
 * 0.5x → 1.1x → 1.0x. Tuned to feel like a physical rubber stamp landing.
 */
function stampScale(progress: number): number {
  if (progress < 0.1) return 0;
  if (progress < 0.7) {
    const t = (progress - 0.1) / 0.6;
    return 0.5 + (1.1 - 0.5) * easeOutCubic(t);
  }
  const t = (progress - 0.7) / 0.3;
  return 1.1 + (1.0 - 1.1) * t;
}

export const ImageReveal = forwardRef<ImageRevealHandle, Props>(function ImageReveal(
  { asset, visible, staticReveal },
  ref
) {
  const groupRef = useRef<SVGGElement | null>(null);
  const userOpacity = asset.opacity ?? 1;

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
            style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
            style.transform = '';
            break;
          }
          case 'stamp': {
            const visible = p > 0.05;
            g.setAttribute('opacity', visible ? userOpacity.toString() : '0');
            style.clipPath = '';
            style.transformBox = 'fill-box';
            style.transformOrigin = 'center';
            style.transform = `scale(${stampScale(p).toFixed(3)})`;
            break;
          }
          case 'fade':
          case 'draw':
          default: {
            g.setAttribute('opacity', (userOpacity * easeOutCubic(p)).toString());
            style.clipPath = '';
            style.transform = '';
            break;
          }
        }
      },
    }),
    [asset.revealMode, userOpacity]
  );

  if (!visible) return null;

  if (staticReveal) {
    return (
      <g style={{ opacity: userOpacity }}>
        <image
          href={asset.src}
          x={0}
          y={0}
          width={asset.width}
          height={asset.height}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    );
  }

  return (
    <g ref={groupRef} opacity={0}>
      <image
        href={asset.src}
        x={0}
        y={0}
        width={asset.width}
        height={asset.height}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
});
