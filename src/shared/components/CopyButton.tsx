import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';

interface CopyButtonProps {
  /** The text that lands on the clipboard. */
  value: string;
  /** Tooltip while idle; "Copied" replaces it for a moment after a click. */
  title?: string;
  /** Button edge in px (the icon scales with it). Defaults to the inspector's 26 px row. */
  size?: number;
  className?: string;
}

/**
 * A one-click copy icon with an in-place "Copied" flash — no toast. Sits
 * beside a read-only value (a clip name, a shot id) so it can be pasted
 * into the assistant or a note.
 */
export function CopyButton({ value, title = 'Copy', size = 26, className = '' }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();
  const iconSize = Math.max(10, Math.round(size * 0.5));
  return (
    <button
      type="button"
      title={copied ? 'Copied' : title}
      aria-label={title}
      data-copied={copied ? 'true' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        void copy(value);
      }}
      className={`shrink-0 flex items-center justify-center rounded-[6px] transition-colors ${
        copied ? 'text-accent-green' : 'text-text-muted hover:text-text-primary hover:bg-app-hover'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </button>
  );
}
