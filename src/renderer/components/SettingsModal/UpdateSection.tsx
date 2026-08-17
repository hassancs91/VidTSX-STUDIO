import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, ProgressBar } from '@shared/components';
import { useUpdater } from '../../hooks/useUpdater';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function formatRelative(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const RELEASES_URL = 'https://github.com/hassancs91/VidTSX-STUDIO/releases';

/**
 * Settings → Updates. This is the only place update errors are shown: the user
 * asked, so the app must answer (docs/auto-update-plan.md §5.1).
 */
export function UpdateSection() {
  const {
    state,
    checking,
    blocked,
    check,
    download,
    cancel,
    install,
    setAutoDownload,
    setChannel,
  } = useUpdater();
  const [notesOpen, setNotesOpen] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="text-[12px] text-text-secondary">Loading update status…</div>
      </div>
    );
  }

  const handleInstall = async () => {
    setInstallMessage(null);
    const response = await install();
    if (response && !response.success && response.reason === 'busy') {
      setInstallMessage(`Can't restart yet — ${response.blockers?.join(', ') ?? 'work in progress'}.`);
    }
  };

  const openReleases = () => {
    void window.api.appOpenExternal({ url: RELEASES_URL });
  };

  // Dev build, unsigned macOS, or a fork without a publish config: the automatic
  // path cannot work, so point at the manual one instead of failing quietly.
  if (state.status === 'unsupported') {
    return (
      <div className="bg-app-surface rounded-lg p-3 border border-border flex flex-col gap-2">
        <div className="text-[12px] text-text-secondary">
          VidTSX Studio v{state.currentVersion}
        </div>
        <div className="text-[10px] text-text-dim">
          {state.unsupportedReason ?? 'Automatic updates are unavailable in this build.'}
        </div>
        <div>
          <Button variant="secondary" onClick={openReleases}>
            View releases on GitHub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-app-surface rounded-lg p-3 border border-border flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-text-secondary">
              VidTSX Studio v{state.currentVersion}
            </div>
            <div className="text-[10px] text-text-dim mt-0.5">
              {checking
                ? 'Checking for updates…'
                : state.status === 'not-available'
                  ? "You're on the latest version."
                  : state.lastCheckedAt
                    ? `Last checked ${formatRelative(state.lastCheckedAt)}`
                    : 'Not checked yet'}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => { void check(); }}
            disabled={checking || state.status === 'downloading'}
          >
            {checking ? 'Checking…' : 'Check for updates'}
          </Button>
        </div>

        {state.status === 'error' && state.error && (
          <div className="text-[10px] text-accent-red">{state.error}</div>
        )}

        {(state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded') &&
          state.availableVersion && (
            <div className="border-t border-border pt-2 flex flex-col gap-2">
              <div className="text-[11px] text-text-secondary">
                Version {state.availableVersion} available
                {state.releaseDate && (
                  <span className="text-text-dim">
                    {' · '}
                    {new Date(state.releaseDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {state.releaseNotes && (
                <div>
                  <button
                    onClick={() => setNotesOpen((open) => !open)}
                    className="text-[10px] text-accent hover:text-accent-light transition-colors"
                  >
                    {notesOpen ? '▾ What’s new' : '▸ What’s new'}
                  </button>
                  {notesOpen && (
                    <div className="text-[10px] text-text-dim mt-1 max-h-40 overflow-y-auto prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {state.releaseNotes}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {state.status === 'available' && (
                <div>
                  <Button variant="primary" onClick={() => { void download(); }}>
                    Download update
                  </Button>
                </div>
              )}

              {state.status === 'downloading' && (
                <div className="flex flex-col gap-1">
                  <ProgressBar value={state.progress?.percent ?? 0} />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-dim">
                      {formatBytes(state.progress?.transferred ?? 0)} /{' '}
                      {formatBytes(state.progress?.total ?? 0)}
                      {state.progress?.bytesPerSecond
                        ? ` · ${formatBytes(state.progress.bytesPerSecond)}/s`
                        : ''}
                    </span>
                    <Button variant="secondary" onClick={() => { void cancel(); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {state.status === 'downloaded' && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      onClick={() => { void handleInstall(); }}
                      disabled={blocked || state.installing}
                    >
                      {state.installing ? 'Preparing…' : 'Restart & install'}
                    </Button>
                    <span className="text-[10px] text-text-dim">
                      Or it installs automatically next time you quit.
                    </span>
                  </div>
                  {blocked && (
                    <div className="text-[10px] text-text-dim italic">
                      Waiting on: {state.blockers.join(', ')}
                    </div>
                  )}
                  {installMessage && (
                    <div className="text-[10px] text-accent-red">{installMessage}</div>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted mb-1">Download updates automatically</div>
            <div className="text-[10px] text-text-dim">
              Updates download quietly in the background. You still choose when to restart.
            </div>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 accent-accent cursor-pointer shrink-0"
            checked={state.autoDownload}
            onChange={(e) => void setAutoDownload(e.target.checked)}
          />
        </div>
      </div>

      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted mb-1">Receive beta releases</div>
            <div className="text-[10px] text-text-dim">
              Get pre-release builds first. They ship more often and are less tested.
            </div>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 accent-accent cursor-pointer shrink-0"
            checked={state.channel === 'beta'}
            onChange={(e) => void setChannel(e.target.checked ? 'beta' : 'stable')}
          />
        </div>
      </div>

      <button
        onClick={openReleases}
        className="text-[10px] text-accent hover:text-accent-light transition-colors self-start"
      >
        View all releases on GitHub →
      </button>
    </div>
  );
}
