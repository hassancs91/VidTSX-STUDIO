import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { shouldShowCrashReportingPrompt } from '@shared/crash-reporting-prompt';

/**
 * First-launch consent prompt for crash reporting (go-live decision D3).
 * Shown once, only in builds that carry a DSN, until the user answers. Either
 * answer goes through the same IPC as the Settings > Privacy toggle, which
 * also marks the prompt as answered, so Settings stays the place to change
 * it later. A failed save is not fatal: the prompt simply returns next launch.
 */
export function CrashReportingPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api
      .settingsGet()
      .then((settings) => {
        if (cancelled) return;
        setVisible(
          shouldShowCrashReportingPrompt({
            available: settings.crashReportingAvailable,
            prompted: settings.crashReportingPrompted,
            enabled: settings.crashReportingEnabled,
          }),
        );
      })
      .catch(() => {
        // Settings unreadable: stay hidden, never block the app on this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const answer = async (enabled: boolean) => {
    setBusy(true);
    try {
      await window.api.settingsSetCrashReporting({ enabled });
    } catch {
      // Recorded on a later launch instead.
    }
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-10 right-4 z-50 w-[360px] rounded-[8px] bg-app-active p-3 shadow-lg"
      style={{ border: '0.5px solid var(--color-border)' }}
      role="dialog"
      aria-label="Crash reports"
      data-testid="crash-reporting-prompt"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={14} strokeWidth={1.75} className="mt-[1px] shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-text-primary">Help fix bugs with crash reports?</div>
          <div className="mt-1 text-[10px] leading-snug text-text-muted">
            When something breaks, the app can send the stack trace, app version and OS to
            Sentry. Never your prompts, files, transcripts or API keys, and file paths are
            anonymized. Change this anytime in Settings → Privacy.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(true)}
              className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Enable
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
