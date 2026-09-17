import { useMemo } from 'react';
import { StatusBadge } from '@shared/components';
import { useVideoLibrary } from '../hooks/useVideoLibrary';
import { profileToCatalogRow, splitCatalogSections } from '../services/catalog-sections';
import { InstalledModelsList } from './InstalledModelsList';
import { AllModelsList } from './local/AllModelsList';
import { LocalModelPage } from './local/LocalModelPage';
import { LocalModelStatusStrip } from './local/LocalModelStatusStrip';
import { RecommendedModelsList } from './local/RecommendedModelsList';
import { SdCliRuntimeChip } from './local/SdCliRuntimeChip';

/**
 * The Video section on the local-model template (docs/ai-models-redesign.md
 * §3.3 / §3.5): sd-cli chip + models folder, Installed, the five recommended
 * picks with a "Tested" chip where a release pass generated a clip, and the
 * full catalog behind "All models". This page manages models only — a ready
 * model generates from the Videos screen, Studio, the agents and Flows through
 * the video engine's "Local (open source)" provider (D3).
 */
export function VideoModelsContent() {
  const lib = useVideoLibrary();

  const sections = useMemo(() => {
    const split = splitCatalogSections(lib.scan.profiles);
    return { recommended: split.recommended.map(profileToCatalogRow), all: split.all.map(profileToCatalogRow) };
  }, [lib.scan.profiles]);

  const readyCount = lib.scan.installed.filter((m) => m.ready).length;
  const catalogActions = {
    onDownload: lib.downloadProfile,
    onPause: lib.pauseDownload,
    onResume: lib.resumeDownload,
    onCancel: lib.cancelDownload,
    onOpenExternal: lib.openExternal,
  };

  return (
    <LocalModelPage
      strip={
        <LocalModelStatusStrip
          runtime={<SdCliRuntimeChip />}
          folder={lib.scan.folder}
          onOpenFolder={lib.openFolder}
          onRescan={lib.rescan}
          note={
            <span className="flex flex-wrap items-center gap-1.5">
              {readyCount > 0 ? (
                <StatusBadge tone="success">{`${readyCount} ready`}</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">No model ready</StatusBadge>
              )}
              Ready models generate as “Local (open source)” in Videos, Studio, the agents and Flows.
            </span>
          }
        />
      }
      loading={lib.loading}
      error={lib.error ? { message: lib.error } : null}
      onClearError={lib.clearError}
      installed={
        <InstalledModelsList
          installed={lib.scan.installed}
          unrecognized={lib.scan.unrecognized}
          activeModelId={null}
          onDelete={lib.removeModel}
          onReveal={lib.openFolder}
          onOpenExternal={lib.openExternal}
        />
      }
      recommended={
        <RecommendedModelsList
          rows={sections.recommended}
          downloads={lib.downloads}
          caption="Five picks across hardware tiers, smallest first. Tested marks a model a release pass generated a clip from on a supported machine."
          {...catalogActions}
        />
      }
      all={<AllModelsList rows={sections.all} downloads={lib.downloads} {...catalogActions} />}
    />
  );
}
