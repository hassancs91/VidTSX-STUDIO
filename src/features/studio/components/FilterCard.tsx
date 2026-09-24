import { useEffect, useRef, useState } from 'react';
import type { FilterDefinition } from '@shared/types/studio';
import { createFilterRenderer, type FilterRenderer } from '@shared/studio/filter-runtime';
import demoUrl from '../assets/filter-demo.jpg';

interface Props {
  kind: string;
  name: string;
  tagline?: string;
  description?: string;
  animated: boolean;
  /** Slow enough for the card to say so — informational, the export is exact. */
  heavy: boolean;
  /** Undefined until its module has loaded (or when it failed to). */
  definition: FilterDefinition | undefined;
  /** The target clips already use this kind. */
  active: boolean;
  /** Why a click does nothing right now (no eligible clip selected). */
  blockedReason: string | null;
  /** First time the card scrolls into view — the panel loads its module then. */
  onVisible: (kind: string) => void;
  onPick: (kind: string) => void;
}

/** The card's working size: ~130 px wide on screen, painted at 2×. */
const CARD_WIDTH = 256;
const CARD_HEIGHT = 144;

/** One demo still for every card (the add-ons' generated portrait), decoded once. */
let demoStill: Promise<HTMLImageElement> | null = null;
function loadDemoStill(): Promise<HTMLImageElement> {
  if (!demoStill) {
    demoStill = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The filter demo still failed to load.'));
      img.src = demoUrl;
    });
  }
  return demoStill;
}

/**
 * One gallery card: a small canvas painted by the real filter over the demo
 * still (docs/studio/FILTER_PACKS_DESIGN.md "UI"). A static filter draws once;
 * an animated one loops while hovered or focused, for the same cost reason
 * the transition cards rest on a poster. Nothing paints off screen.
 */
export function FilterCard({
  kind,
  name,
  tagline,
  description,
  animated,
  heavy,
  definition,
  active,
  blockedReason,
  onVisible,
  onPick,
}: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer = useRef<FilterRenderer | null>(null);
  const [inView, setInView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const notified = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      setInView(visible);
      if (visible && !notified.current) {
        notified.current = true;
        onVisible(kind);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [kind, onVisible]);

  // Paint: time 0 at rest; an animated filter advances while playing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!inView || !definition || !canvas) return;
    let cancelled = false;
    let raf = 0;
    void loadDemoStill().then((still) => {
      if (cancelled) return;
      if (!renderer.current) renderer.current = createFilterRenderer(canvas);
      const paint = (time: number) => {
        try {
          renderer.current?.render(definition, { source: still, time, options: { intensity: definition.defaultIntensity } });
        } catch (err) {
          console.warn(`[filters] ${kind} failed to paint its card:`, err);
          cancelAnimationFrame(raf);
        }
      };
      paint(0);
      if (animated && playing) {
        const started = performance.now();
        const loop = () => {
          paint((performance.now() - started) / 1000);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [inView, definition, animated, playing, kind]);

  useEffect(
    () => () => {
      renderer.current?.dispose();
      renderer.current = null;
    },
    [],
  );

  const tooltip = [
    tagline,
    description,
    heavy ? 'Heavy: the preview may drop frames on a slower machine. The export is exact.' : null,
    blockedReason,
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <button
      ref={ref}
      onClick={() => {
        if (!blockedReason) onPick(kind);
      }}
      onPointerEnter={() => setPlaying(true)}
      onPointerLeave={() => setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={() => setPlaying(false)}
      title={tooltip || name}
      aria-disabled={blockedReason !== null}
      aria-pressed={active}
      data-filter-card={kind}
      className={`flex flex-col rounded-[6px] overflow-hidden text-left transition-colors ${
        active ? 'bg-app-active' : 'bg-app-surface hover:bg-app-hover'
      } ${blockedReason ? 'cursor-default' : ''}`}
      style={{
        border: active ? '0.5px solid var(--color-accent)' : '0.5px solid var(--color-border)',
      }}
    >
      <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          className="absolute inset-0 w-full h-full"
          data-filter-card-canvas={definition ? 'ready' : 'loading'}
        />
        {!definition && (
          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-text-ghost">Preview…</div>
        )}
        {heavy && (
          <span
            className="absolute top-1 right-1 text-[9px] leading-none px-[5px] py-[2px] rounded-[4px]"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--color-accent-amber)' }}
            data-heavy-badge
          >
            heavy
          </span>
        )}
      </div>
      <div className="px-1.5 py-1 flex items-center gap-1 min-w-0">
        <span className={`text-[10px] truncate ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{name}</span>
        {animated && <span className="ml-auto shrink-0 text-[9px] text-text-dim">animated</span>}
      </div>
    </button>
  );
}
