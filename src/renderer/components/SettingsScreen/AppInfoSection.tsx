import { Button } from '@shared/components';
import { useUpdaterContext } from '../../contexts/UpdaterContext';

export function AppInfoSection({ handleOpenLink }: { handleOpenLink: (url: string) => Promise<void> }) {
  const { phase, currentVersion, newVersion, justUpToDate, check, install } = useUpdaterContext();
  const checking = phase === 'checking';

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[12px] text-text-secondary">
            VidTSX Studio v{currentVersion || '…'}
          </div>
          <span
            className="text-accent-light"
            style={{
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              padding: '1px 5px',
              borderRadius: '3px',
              border: '0.5px solid var(--color-accent-light)',
              lineHeight: 1,
            }}
          >
            BETA
          </span>
        </div>
        <Button
          variant="secondary"
          onClick={() => void check()}
          disabled={checking}
        >
          {checking ? 'Checking…' : 'Check for Updates'}
        </Button>
      </div>

      {justUpToDate && (
        <div className="text-[11px] text-accent-green mt-2">
          You're on the latest version
        </div>
      )}

      {phase === 'ready' && newVersion && (
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <div className="text-[11px] text-text-secondary">
            v{newVersion} is ready — Restart to install
          </div>
          <Button variant="primary" onClick={() => void install()}>
            Restart Now
          </Button>
        </div>
      )}

      <button
        className="text-[11px] text-accent hover:underline mt-2 block"
        onClick={() => handleOpenLink('https://learnwithhasan.com')}
      >
        learnwithhasan.com
      </button>
    </div>
  );
}
