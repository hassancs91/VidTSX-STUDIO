import { useMemo, useState } from 'react';
import { isFeatureEnabled } from '@shared/feature-flags';
import type { InstalledModelIpc, ModelSetupConfig } from '@shared/ipc/types';
import { useImageModelParams } from '@renderer/hooks/useImageModelParams';
import { hasAnyImageParams } from '@shared/presets/image-model-params';
import { useImageLibrary } from '../hooks/useImageLibrary';
import { profileToCatalogRow, splitCatalogSections } from '../services/catalog-sections';
import { InstalledModelsList } from './InstalledModelsList';
import { ModelSetupDialog, type ModelSetupResult } from './ModelSetupDialog';
import { ModelParamsDialog } from './ModelParamsDialog';
import { ImageToolsSection } from './ImageToolsSection';
import { AllModelsList } from './local/AllModelsList';
import { LocalModelPage } from './local/LocalModelPage';
import { LocalModelStatusStrip } from './local/LocalModelStatusStrip';
import { RecommendedModelsList } from './local/RecommendedModelsList';
import { SdCliRuntimeChip } from './local/SdCliRuntimeChip';

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

/**
 * The Image section on the local-model template (docs/ai-models-redesign.md
 * §3.3 / §3.4): sd-cli chip + models folder, Installed, the eight recommended
 * picks, and the full catalog behind "All models".
 */
export function ImageModelsContent() {
  const lib = useImageLibrary();
  const params = useImageModelParams();
  const [setupTarget, setSetupTarget] = useState<SetupTarget | null>(null);
  const [paramsTarget, setParamsTarget] = useState<InstalledModelIpc | null>(null);

  const sections = useMemo(() => {
    const split = splitCatalogSections(lib.scan.profiles);
    return { recommended: split.recommended.map(profileToCatalogRow), all: split.all.map(profileToCatalogRow) };
  }, [lib.scan.profiles]);

  const catalogActions = {
    onDownload: lib.downloadProfile,
    onPause: lib.pauseDownload,
    onResume: lib.resumeDownload,
    onCancel: lib.cancelDownload,
    onOpenExternal: lib.openExternal,
  };

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
    <LocalModelPage
      strip={
        <LocalModelStatusStrip
          runtime={<SdCliRuntimeChip />}
          folder={lib.scan.folder}
          onChangeFolder={lib.changeFolder}
          onOpenFolder={lib.openFolder}
          onRescan={lib.rescan}
          onImport={handleImport}
        />
      }
      loading={lib.loading}
      error={lib.error}
      onClearError={lib.clearError}
      installed={
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
      }
      recommended={
        <RecommendedModelsList
          rows={sections.recommended}
          downloads={lib.downloads}
          caption="One or two picks per hardware tier, smallest first — the Fits badge is the verdict for this machine."
          {...catalogActions}
        />
      }
      all={<AllModelsList rows={sections.all} downloads={lib.downloads} {...catalogActions} />}
      extras={SHOW_IMAGE_TOOLS ? <ImageToolsSection /> : undefined}
    >
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
    </LocalModelPage>
  );
}
