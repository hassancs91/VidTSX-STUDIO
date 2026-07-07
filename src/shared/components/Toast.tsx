import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  type: ToastType;
  action?: ToastAction;
  onClose: () => void;
  duration?: number;
}

const accentColors: Record<ToastType, string> = {
  success: 'var(--color-accent-green)',
  error: 'var(--color-accent-red)',
  info: 'var(--color-accent)',
};

export function Toast({ message, type, action, onClose, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 150); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-app-surface transition-opacity duration-150 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        border: '0.5px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '240px',
        maxWidth: '400px',
      }}
    >
      {/* Left accent bar */}
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ backgroundColor: accentColors[type] }}
      />

      {/* Message */}
      <span className="text-[12px] text-text-secondary flex-1">{message}</span>

      {/* Action button */}
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="text-[11px] text-accent hover:text-accent-light transition-colors whitespace-nowrap"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
