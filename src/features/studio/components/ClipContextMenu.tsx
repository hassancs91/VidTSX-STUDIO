import { useEffect, useRef, useState, useLayoutEffect } from 'react';

export interface ClipContextMenuItem {
  // A label of '-' renders a separator.
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ClipContextMenuProps {
  x: number;
  y: number;
  items: ClipContextMenuItem[];
  onClose: () => void;
}

// Lightweight right-click menu for timeline clips. Closes on outside click,
// Escape, scroll, or window blur. Position is clamped to stay on-screen.
export function ClipContextMenu({ x, y, items, onClose }: ClipContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Outside mousedown closes; the menu stops propagation on its own mousedown.
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    // Capture phase so any scroll (incl. inner scrollers) dismisses it.
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 6;
    let left = x;
    let top = y;
    if (left + rect.width + margin > window.innerWidth) left = window.innerWidth - rect.width - margin;
    if (top + rect.height + margin > window.innerHeight) top = window.innerHeight - rect.height - margin;
    setPos({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-[1000] min-w-[176px] py-[4px] rounded-[6px] select-none"
      style={{
        left: pos.left,
        top: pos.top,
        backgroundColor: 'var(--color-app-surface)',
        border: '0.5px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.label === '-' ? (
          <div key={i} className="my-[4px] mx-[8px]" style={{ height: 1, backgroundColor: 'var(--color-border)' }} />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={`w-full flex items-center px-[12px] h-[26px] text-left text-[11px] transition-colors ${
              item.disabled
                ? 'text-text-dim cursor-not-allowed'
                : item.danger
                  ? 'text-text-muted hover:text-status-error hover:bg-app-hover'
                  : 'text-text-muted hover:text-text-primary hover:bg-app-hover'
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
