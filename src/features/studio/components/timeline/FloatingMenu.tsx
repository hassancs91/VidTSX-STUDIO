import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface FloatingMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  /** Render in the danger color (delete actions). */
  danger?: boolean;
}

interface Props {
  /** Viewport coordinates — the menu is portaled to document.body and
   *  position:fixed, so they are measured from the window, never a panel. */
  x: number;
  y: number;
  items: FloatingMenuItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * Minimal in-renderer menu for the timeline (track options, add-track kinds).
 * Deliberately NOT the native Electron context menu: this one closes over
 * document state without an IPC round-trip and can be driven in CDP tests.
 *
 * Rendered through a portal on document.body: `position: fixed` is measured
 * from the nearest TRANSFORMED ancestor, not the viewport, so a menu mounted
 * inside e.g. the track-header column's `translateY` scroll-follow wrapper
 * landed hundreds of pixels off and was clipped away by the column's
 * overflow:hidden — the kebab "did nothing" (Hasan, 2026-10-05). The portal
 * frees the menu from every ancestor's transform, overflow and stacking
 * context; the viewport coordinates it is given stay valid.
 */
export function FloatingMenu({ x, y, items, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture phase + stopPropagation so Escape closes the menu without
      // also clearing the timeline selection (useTimelineShortcuts).
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  // Keep the menu on-screen when opened near the bottom edge.
  const maxY = typeof window !== 'undefined' ? window.innerHeight - items.length * 26 - 12 : y;

  // React synthetic events still bubble through a portal to the React
  // ancestors (the track header's click-to-select, the ruler's scrub-on-
  // pointerdown, a pool card's click…). A pick must not double as a click on
  // whatever opened the menu, so everything stops at the menu root.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 min-w-[132px] py-1 rounded-[6px] bg-app-surface shadow-lg"
      style={{ left: x, top: Math.max(4, Math.min(y, maxY)), border: '0.5px solid var(--color-border)' }}
      role="menu"
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            onPick(item.id);
            onClose();
          }}
          className={`w-full text-left px-2.5 h-[26px] text-[11px] transition-colors disabled:opacity-30 disabled:cursor-default ${
            item.danger
              ? 'text-accent-red hover:bg-app-hover'
              : 'text-text-secondary hover:bg-app-hover hover:text-text-primary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
