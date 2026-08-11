import { useEffect, useRef } from 'react';

export interface FloatingMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  /** Render in the danger color (delete actions). */
  danger?: boolean;
}

interface Props {
  /** Viewport coordinates — the menu is position:fixed so it can escape the
   *  track-header column's overflow:hidden. */
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

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[132px] py-1 rounded-[6px] bg-app-surface shadow-lg"
      style={{ left: x, top: Math.max(4, Math.min(y, maxY)), border: '0.5px solid var(--color-border)' }}
      role="menu"
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
    </div>
  );
}
