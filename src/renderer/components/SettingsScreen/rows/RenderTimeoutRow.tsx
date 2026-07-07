import { useState, useEffect } from 'react';
import { TextInput } from '@shared/components';

export function RenderTimeoutRow({
  renderTimeoutSeconds,
  setRenderTimeoutSeconds,
  settingsLoading,
}: {
  renderTimeoutSeconds: number;
  setRenderTimeoutSeconds: (seconds: number) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  // Local draft so the user can type without each keystroke hitting IPC / being
  // clamped. We commit on blur or Enter. Keep as string to allow a transient empty
  // input while editing.
  const [draft, setDraft] = useState(String(renderTimeoutSeconds));

  // Sync local draft when the saved value changes (e.g. after initial load).
  useEffect(() => {
    setDraft(String(renderTimeoutSeconds));
  }, [renderTimeoutSeconds]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(renderTimeoutSeconds));
      return;
    }
    const clamped = Math.min(3600, Math.max(30, parsed));
    setDraft(String(clamped));
    if (clamped !== renderTimeoutSeconds) {
      void setRenderTimeoutSeconds(clamped);
    }
  };

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-text-muted mb-1">
            Per-frame render timeout
          </div>
          <div className="text-[10px] text-text-dim">
            Max seconds Remotion waits for a single frame before failing. Increase
            for heavy WebGL/Three.js compositions. Range: 30–3600s.
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TextInput
            type="number"
            min={30}
            max={3600}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={settingsLoading}
            className="w-[80px] text-right"
          />
          <span className="text-[11px] text-text-muted">s</span>
        </div>
      </div>
    </div>
  );
}
