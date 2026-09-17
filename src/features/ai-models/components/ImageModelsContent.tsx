import { useState } from 'react';
import { ErrorBanner } from '@shared/components';
import { isFeatureEnabled } from '@shared/feature-flags';
import type { InstalledModelIpc, ModelSetupConfig } from '@shared/ipc/types';
import { useImageModelParams } from '@renderer/hooks/useImageModelParams';
import { hasAnyImageParams } from '@shared/presets/image-model-params';
import { useImageLibrary } from '../hooks/useImageLibrary';
import { ImageLibraryHeader } from './ImageLibraryHeader';
import { SdCliSetupCard } from './SdCliSetupCard';
import { InstalledModelsList } from './InstalledModelsList';
import { ProfileCatalogList } from './ProfileCatalogList';
import { ModelSetupDialog, type ModelSetupResult } from './ModelSetupDialog';
import { ModelParamsDialog } from './ModelParamsDialog';
import { ImageToolsSection } from './ImageToolsSection';

/** The local sd-cli provider's id in the image engine (keys its param overrides). */
const LOCAL_PROVIDER_ID = 'local';

// Runtime-backed image tools (background removal) stay behind the runtime flag until
// Stage 5 of docs/ai-runtime-implementation-plan.md.
const SHOW_IMAGE_TOOLS = isFeatureEnabled('ai-system-runtimes');

function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

type SetupTarget =
  | { kind: 'import'; sourcePath: string; fileName: string }
  | { kind: 'configure'; filePath: string; fileName: string };

export function ImageModelsContent() {
  const lib = useImageLibrary();
  const params = useImageModelParams();
  const [setupTarget, setSetupTarget] = useState<SetupTarget | null>(null);
  const [paramsTarget, setParamsTarget] = useState<InstalledModelIpc | null>(null);

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

      {!lib.loading && !lib.cliInstalled && (
        <SdCliSetupCard install={lib.cliInstall} onInstall={lib.installCli} />
      )}

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
            onParams={setParamsTarget}
            hasParams={(id) => hasAnyImageParams(params.get(LOCAL_PROVIDER_ID, id))}
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

          {SHOW_IMAGE_TOOLS && <ImageToolsSection />}
        </div>
      )}

      {lib.error && (
        <div className="mt-3">
          <ErrorBanner message={lib.error.message} details={lib.error.details} onDismiss={lib.clearError} />
        </div>
      )}

      {paramsTarget?.paramSchema && (
        <ModelParamsDialog
          title={paramsTarget.name}
          subtitle={`${paramsTarget.family} · ${paramsTarget.id}`}
          schema={paramsTarget.paramSchema}
          defaults={paramsTarget.paramDefaults}
          initial={params.get(LOCAL_PROVIDER_ID, paramsTarget.id)}
          busy={params.busy}
          onSave={async (next) => {
            const ok = await params.save(LOCAL_PROVIDER_ID, paramsTarget.id, next);
            if (ok) setParamsTarget(null);
            return ok;
          }}
          onCancel={() => setParamsTarget(null)}
        />
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
