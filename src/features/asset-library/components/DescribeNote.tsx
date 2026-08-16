interface DescribeNoteProps {
  /** Why describing is unavailable — shown verbatim as the lead sentence. */
  message: string;
  onDismiss: () => void;
}

/**
 * The no-provider note (ASSET_LIBRARY_DESIGN.md L2 Rev 3). It is a NOTE,
 * not an error: nothing is broken, imports still land, and manual
 * descriptions work exactly as before. What it has to get across is why
 * bothering with descriptions and folders pays off at all — they are what
 * make the Studio agent pick the right asset.
 *
 * Dismissible, and the dismissal sticks (stored in library prefs).
 */
export function DescribeNote({ message, onDismiss }: DescribeNoteProps) {
  return (
    <div
      data-describe-note
      className="flex items-start gap-3 px-3 py-2 rounded bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div className="flex-1 min-w-0 text-[11px] leading-[1.5] text-text-secondary">
        <span className="text-text-primary">{message}</span>{' '}
        Descriptions and folder structure are what make the Studio agent pick the
        right asset — write them by hand here, or configure an AI provider in
        Settings to draft them for you.
      </div>
      <button
        type="button"
        onClick={onDismiss}
        data-describe-note-dismiss
        className="shrink-0 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-primary hover:bg-app-hover"
      >
        Dismiss
      </button>
    </div>
  );
}
