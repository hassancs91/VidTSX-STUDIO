import { Button } from '@shared/components';
import { useVideoLibrary } from '../hooks/useVideoLibrary';
import { InstalledModelsList } from './InstalledModelsList';
import { ProfileCatalogList } from './ProfileCatalogList';
import { VideoGeneratePanel } from './VideoGeneratePanel';

function truncatePath(p: string, maxLen = 46): string {
  if (!p) return '(no folder)';
  if (p.length <= maxLen) return p;
  return `${p.slice(0, 16)}…${p.slice(-26)}`;
}

/**
 * Video models library + generation (Wan / LTX / LingBot via sd-cli vid_gen).
 */
export function VideoModelsContent() {
  const lib = useVideoLibrary();

  const uninstalledProfiles = lib.scan.profiles.filter((p) => !p.installed);
  const readyModels = lib.scan.installed.filter((m) => m.ready);

  return (
    <>
      <div className="bg-app-surface rounded-lg p-3 border border-border mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted mb-0.5">Models folder</div>
            <div className="text-[12px] text-text-secondary font-mono truncate" title={lib.scan.folder}>
              {truncatePath(lib.scan.folder)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={lib.openFolder}>Open folder</Button>
            <Button variant="secondary" size="sm" onClick={lib.rescan}>Rescan</Button>
          </div>
        </div>
      </div>

      {!lib.loading && readyModels.length === 0 && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-500/10 text-[11px] text-blue-400">
          Download a model below — once its companion files are in place, a Generate panel
          appears here.
        </div>
      )}

      {lib.loading ? (
        <div className="p-4 text-[12px] text-text-muted text-center">Scanning models folder…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {readyModels.length > 0 && <VideoGeneratePanel readyModels={readyModels} />}

          <InstalledModelsList
            installed={lib.scan.installed}
            unrecognized={lib.scan.unrecognized}
            activeModelId={null}
            onDelete={lib.removeModel}
            onReveal={lib.openFolder}
            onOpenExternal={lib.openExternal}
          />

          <ProfileCatalogList
            profiles={uninstalledProfiles}
            downloads={lib.downloads}
            onDownload={lib.downloadProfile}
            onPause={lib.pauseDownload}
            onResume={lib.resumeDownload}
            onCancel={lib.cancelDownload}
            onOpenExternal={lib.openExternal}
          />
        </div>
      )}

      {lib.error && (
        <div className="mt-3 px-3 py-2 rounded bg-accent-red/10 text-[11px] text-accent-red flex items-center justify-between">
          <span>{lib.error}</span>
          <button onClick={lib.clearError} className="text-text-dim hover:text-text-secondary ml-2">✕</button>
        </div>
      )}
    </>
  );
}
