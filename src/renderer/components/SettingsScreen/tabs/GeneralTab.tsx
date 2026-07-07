import { Button } from '@shared/components';
import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from '@shared/ipc/types';
import { SectionHeader } from '../SectionHeader';
import { LicenseSection } from '../LicenseSection';
import { AppInfoSection } from '../AppInfoSection';
import { isFeatureEnabled } from '@shared/feature-flags';
import { RenderTimeoutRow } from '../rows/RenderTimeoutRow';
import { CpuUsageDefaultRow } from '../rows/CpuUsageDefaultRow';
import { GpuBackendDefaultRow } from '../rows/GpuBackendDefaultRow';
import { HardwareAccelerationDefaultRow } from '../rows/HardwareAccelerationDefaultRow';

export function GeneralTab({
  outputFolder,
  aiModelsFolder,
  renderTimeoutSeconds,
  renderDefaultCpuUsage,
  renderDefaultGpuBackend,
  renderDefaultHardwareAcceleration,
  settingsLoading,
  browseOutputFolder,
  browseAiModelsFolder,
  setRenderTimeoutSeconds,
  setRenderDefaultCpuUsage,
  setRenderDefaultGpuBackend,
  setRenderDefaultHardwareAcceleration,
  handleOpenLink,
}: {
  outputFolder: string;
  aiModelsFolder: string;
  renderTimeoutSeconds: number;
  renderDefaultCpuUsage: RenderCpuUsage;
  renderDefaultGpuBackend: RenderGpuBackend;
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  settingsLoading: boolean;
  browseOutputFolder: () => void;
  browseAiModelsFolder: () => void;
  setRenderTimeoutSeconds: (seconds: number) => Promise<boolean>;
  setRenderDefaultCpuUsage: (value: RenderCpuUsage) => Promise<boolean>;
  setRenderDefaultGpuBackend: (value: RenderGpuBackend) => Promise<boolean>;
  setRenderDefaultHardwareAcceleration: (value: RenderHardwareAcceleration) => Promise<boolean>;
  handleOpenLink: (url: string) => Promise<void>;
}) {
  const truncatePath = (p: string, maxLen = 40) => {
    if (p.length <= maxLen) return p;
    const start = p.slice(0, 15);
    const end = p.slice(-22);
    return `${start}...${end}`;
  };

  return (
    <>
      {/* License shell is dormant (app is free / BYOK) — flip the
          'license-ui' feature flag to resurface it. */}
      {isFeatureEnabled('license-ui') && <LicenseSection handleOpenLink={handleOpenLink} />}

      <SectionHeader>Output</SectionHeader>
      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-text-muted mb-1">
              Default output folder
            </div>
            <div
              className="text-[12px] text-text-secondary font-mono"
              title={outputFolder}
            >
              {settingsLoading ? 'Loading...' : truncatePath(outputFolder)}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={browseOutputFolder}
            disabled={settingsLoading}
          >
            Browse
          </Button>
        </div>
      </div>

      <SectionHeader>Rendering</SectionHeader>
      <div className="flex flex-col gap-2">
        <CpuUsageDefaultRow
          renderDefaultCpuUsage={renderDefaultCpuUsage}
          setRenderDefaultCpuUsage={setRenderDefaultCpuUsage}
          settingsLoading={settingsLoading}
        />
        <GpuBackendDefaultRow
          renderDefaultGpuBackend={renderDefaultGpuBackend}
          setRenderDefaultGpuBackend={setRenderDefaultGpuBackend}
          settingsLoading={settingsLoading}
        />
        <HardwareAccelerationDefaultRow
          renderDefaultHardwareAcceleration={renderDefaultHardwareAcceleration}
          setRenderDefaultHardwareAcceleration={setRenderDefaultHardwareAcceleration}
          settingsLoading={settingsLoading}
        />
        <RenderTimeoutRow
          renderTimeoutSeconds={renderTimeoutSeconds}
          setRenderTimeoutSeconds={setRenderTimeoutSeconds}
          settingsLoading={settingsLoading}
        />
      </div>

      {/* Hidden for beta: re-enable when local AI models (stt, tts, image) ship */}
      {false && (
        <>
          <SectionHeader>AI Models</SectionHeader>
          <div className="bg-app-surface rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-text-muted mb-1">
                  AI models download folder
                </div>
                <div
                  className="text-[12px] text-text-secondary font-mono"
                  title={aiModelsFolder}
                >
                  {settingsLoading ? 'Loading...' : truncatePath(aiModelsFolder)}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={browseAiModelsFolder}
                disabled={settingsLoading}
              >
                Browse
              </Button>
            </div>
            <div className="text-[10px] text-text-dim mt-2">
              Models are organized into subfolders by type (stt, tts, image, etc.)
            </div>
          </div>
        </>
      )}

      <SectionHeader>About</SectionHeader>
      <AppInfoSection handleOpenLink={handleOpenLink} />
    </>
  );
}
