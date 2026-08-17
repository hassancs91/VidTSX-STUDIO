import { useCallback, useEffect, useRef } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { useUpdater } from '../hooks/useUpdater';
import { useToast } from '../contexts/ToastContext';

/**
 * Status-bar update indicator. Deliberately quiet: it renders nothing at all
 * unless an update is actively downloading or is staged and safe to apply.
 *
 * Errors never appear here — a failed background check is not the user's problem.
 * They surface only in Settings → Updates, where the user asked.
 */
export function UpdateChip() {
  const { state, blocked, install } = useUpdater();
  const { showToast } = useToast();
  const announcedVersion = useRef<string | null>(null);

  const status = state?.status;
  const version = state?.availableVersion ?? null;
  const isReady = status === 'downloaded' && !blocked;

  // The gate is polled every 30s, so a render can start between the chip
  // appearing and the click landing. Answer with the reason instead of nothing.
  const handleInstall = useCallback(async () => {
    const response = await install();
    if (response && !response.success && response.reason === 'busy') {
      const reasons = response.blockers?.join(', ') ?? 'work in progress';
      showToast(`Can't restart yet — ${reasons}.`, 'info');
    }
  }, [install, showToast]);

  useEffect(() => {
    // One announcement per version, and only once it is genuinely actionable.
    if (!isReady || !version || announcedVersion.current === version) return;
    announcedVersion.current = version;
    showToast(`VidTSX Studio ${version} is ready to install.`, 'info', {
      label: 'Restart',
      onClick: () => { void handleInstall(); },
    });
  }, [isReady, version, showToast, handleInstall]);

  if (!state) return null;

  if (status === 'downloading') {
    const percent = Math.round(state.progress?.percent ?? 0);
    return (
      <span
        className="text-text-dim flex items-center gap-1"
        style={{ fontSize: '10px' }}
        title={`Downloading update${version ? ` ${version}` : ''}`}
      >
        <ArrowUpCircle size={11} strokeWidth={1.5} className="animate-pulse" />
        Updating… {percent}%
      </span>
    );
  }

  // Staged but the user is mid-render / mid-download: stay silent and let
  // autoInstallOnAppQuit apply it whenever they quit normally.
  if (!isReady) return null;

  return (
    <button
      onClick={() => { void handleInstall(); }}
      title={`Restart to install version ${version}`}
      className="text-accent-light hover:text-accent transition-colors flex items-center gap-1"
      style={{ fontSize: '10px' }}
    >
      <ArrowUpCircle size={11} strokeWidth={1.5} />
      Update ready · Restart
    </button>
  );
}
