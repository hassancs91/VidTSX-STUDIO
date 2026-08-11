export function CrashReportingRow({
  crashReportingEnabled,
  crashReportingAvailable,
  setCrashReportingEnabled,
  settingsLoading,
}: {
  crashReportingEnabled: boolean;
  crashReportingAvailable: boolean;
  setCrashReportingEnabled: (enabled: boolean) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">
            Send crash reports
          </div>
          <div className="text-[10px] text-text-dim">
            Off by default. When enabled, app crashes and errors are sent to Sentry to
            help fix bugs. Reports contain stack traces, app version, and OS — file
            paths are anonymized, and your prompts, projects, and API keys are never
            included.
          </div>
          {!crashReportingAvailable && (
            <div className="text-[10px] text-text-dim mt-1 italic">
              Unavailable — this build was compiled without a crash-reporting
              endpoint, so nothing can be sent.
            </div>
          )}
        </div>
        <input
          type="checkbox"
          className="w-4 h-4 accent-accent cursor-pointer shrink-0 disabled:cursor-not-allowed"
          checked={crashReportingEnabled}
          onChange={(e) => void setCrashReportingEnabled(e.target.checked)}
          disabled={settingsLoading || !crashReportingAvailable}
        />
      </div>
    </div>
  );
}
