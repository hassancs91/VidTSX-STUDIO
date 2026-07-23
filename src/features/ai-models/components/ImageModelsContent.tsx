import { useState } from 'react';
import { ErrorBanner } from '@shared/components';
import type { ModelSetupConfig } from '@shared/ipc/types';
import { useImageLibrary } from '../hooks/useImageLibrary';
import { ImageLibraryHeader } from './ImageLibraryHeader';
import { InstalledModelsList } from './InstalledModelsList';
import { ProfileCatalogList } from './ProfileCatalogList';
import { ModelSetupDialog, type ModelSetupResult } from './ModelSetupDialog';

function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

type SetupTarget =
  | { kind: 'import'; sourcePath: string; fileName: string }
  | { kind: 'configure'; filePath: string; fileName: string };

export function ImageModelsContent() {
  const lib = useImageLibrary();
  const [setupTarget, setSetupTarget] = useState<SetupTarget | null>(null);

  const uninstalledProfiles = lib.scan.profiles.filter((p) => !p.installed);

  const handleImport = async () => {
    const sourcePath = await lib.pickModelFile();
    if (!sourcePath) return;
    setSetupTarget({ kind: 'import', sourcePath, fileName: baseName(sourcePath) });
  };

  const handleSetupConfirm = async (result: ModelSetupResult) => {
    const setup: ModelSetupConfig = { family: result.family, name: result.name, allInOne: result.allInOne };
    const target = setupTarget;
    setSetupTarget(null);
    if (!target) return;
    if (target.kind === 'import') {
      await lib.importModel(target.sourcePath, result.mode, setup);
    } else {
      await lib.configureModel(target.filePath, setup);
    }
  };

  return (
    <>
      <ImageLibraryHeader
        folder={lib.scan.folder}
        cliInstalled={lib.cliInstalled}
        onChangeFolder={lib.changeFolder}
        onOpenFolder={lib.openFolder}
        onRescan={lib.rescan}
        onImport={handleImport}
      />

      {lib.loading ? (
        <div className="p-4 text-[12px] text-text-muted text-center">Scanning models folder…</div>
      ) : (
        <div className="flex flex-col gap-4">
          <InstalledModelsList
            installed={lib.scan.installed}
            unrecognized={lib.scan.unrecognized}
            activeModelId={lib.activeModelId}
            onUse={lib.setActiveModel}
            onDelete={lib.removeModel}
            onReveal={lib.openFolder}
            onSetup={(filePath, fileName) => setSetupTarget({ kind: 'configure', filePath, fileName })}
            onOpenExternal={lib.openExternal}
            downloads={lib.downloads}
            onDownloadCompanions={lib.downloadCompanions}
            onPauseDownload={lib.pauseDownload}
            onResumeDownload={lib.resumeDownload}
            onCancelDownload={lib.cancelDownload}
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
        <div className="mt-3">
          <ErrorBanner message={lib.error.message} details={lib.error.details} onDismiss={lib.clearError} />
        </div>
      )}

      {setupTarget && (
        <ModelSetupDialog
          fileName={setupTarget.fileName}
          showImportMode={setupTarget.kind === 'import'}
          onConfirm={handleSetupConfirm}
          onCancel={() => setSetupTarget(null)}
        />
      )}
    </>
  );
}
