import { useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';

/**
 * Floating chip for the VISIBLE web-capture mode (L6/D12): while a capture
 * window is open for the user to log in / navigate, main pushes a 'pending'
 * event and this chip offers the actual trigger — the user frames the page,
 * then clicks "Capture now" (or cancels). Hidden captures never show it.
 */
export function CaptureChip() {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    return window.api.onLibraryCaptureEvent((event) => {
      setPendingUrl(event.state === 'pending' ? (event.url ?? '') : null);
    });
  }, []);

  if (pendingUrl === null) return null;

  const trigger = (action: 'capture' | 'cancel') => {
    void window.api.libraryCaptureTrigger({ action });
  };

  return (
    <div
      className="fixed bottom-10 right-4 z-50 flex items-center gap-2 rounded-[8px] bg-app-active px-3 py-2 shadow-lg"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-testid="capture-chip"
    >
      <Camera size={13} strokeWidth={1.75} className="shrink-0 text-accent" />
      <div className="max-w-[260px]">
        <div className="text-[11px] text-text-primary leading-snug">
          Capture window open — log in and navigate, then take the shot.
        </div>
        {pendingUrl && (
          <div className="text-[10px] text-text-muted truncate">{pendingUrl}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => trigger('capture')}
        className="shrink-0 rounded-[6px] bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
      >
        Capture now
      </button>
      <button
        type="button"
        onClick={() => trigger('cancel')}
        aria-label="Cancel capture"
        className="shrink-0 rounded-[6px] p-1 text-text-muted hover:text-text-primary"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
