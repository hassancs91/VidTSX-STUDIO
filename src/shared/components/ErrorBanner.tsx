interface ErrorBannerProps {
  /** Friendly, user-facing error line. */
  message: string;
  /** Raw output for debugging — rendered behind an expandable "Details". */
  details?: string | null;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, details, onDismiss }: ErrorBannerProps) {
  return (
    <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <span>{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-dim hover:text-text-secondary shrink-0"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>
      {details && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none text-[10px] text-text-dim hover:text-text-secondary">
            Details
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-app-base/60 p-2 font-mono text-[10px] text-text-secondary">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}
