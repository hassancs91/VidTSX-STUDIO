import { useCallback } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { useToast } from '@renderer/contexts/ToastContext';
import type { HomeUpdate } from '@shared/ipc/types';
import { greetingFor } from '../services/home-format';

interface Props {
  version: string;
  update: HomeUpdate | null;
}

/** The first row of the content: greeting left, version and the update chip
 *  right. The chip only appears when an update is staged and ready — the
 *  status bar's own chip owns the toast, so this one is quiet. */
export function HomeHeader({ version, update }: Props) {
  const { showToast } = useToast();
  const greeting = greetingFor(new Date().getHours());

  const install = useCallback(async () => {
    const res = await window.api.updaterInstall();
    if (res && !res.success && res.reason === 'busy') {
      showToast(`Can't restart yet — ${res.blockers?.join(', ') ?? 'work in progress'}.`, 'info');
    }
  }, [showToast]);

  return (
    <div className="flex items-center justify-between gap-3" data-home-header>
      <div className="text-[13px] font-medium text-text-primary">{greeting}</div>
      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        {update?.downloadingPercent !== null && update?.downloadingPercent !== undefined && (
          <span className="flex items-center gap-1 text-text-dim" title="An update is downloading">
            <ArrowUpCircle size={12} strokeWidth={1.5} className="animate-pulse" />
            Updating… {update.downloadingPercent}%
          </span>
        )}
        {update?.readyVersion && (
          <button
            onClick={() => void install()}
            data-home-update-chip
            title={`Restart to install version ${update.readyVersion}`}
            className="flex items-center gap-1 px-2 h-[22px] rounded-[6px] bg-app-surface text-accent-light hover:bg-app-hover transition-colors"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            <ArrowUpCircle size={12} strokeWidth={1.5} />
            Update {update.readyVersion} ready
          </button>
        )}
        {version && <span data-home-version>VidTSX Studio v{version}</span>}
      </div>
    </div>
  );
}
