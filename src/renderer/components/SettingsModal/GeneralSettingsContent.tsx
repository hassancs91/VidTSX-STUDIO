import { Button, SectionHeader } from '@shared/components';
import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from '@shared/ipc/types';
import { AppInfoSection } from './AppInfoSection';
import { RenderTimeoutRow } from './rows/RenderTimeoutRow';
import { CpuUsageDefaultRow } from './rows/CpuUsageDefaultRow';
import { GpuBackendDefaultRow } from './rows/GpuBackendDefaultRow';
import { HardwareAccelerationDefaultRow } from './rows/HardwareAccelerationDefaultRow';

export function GeneralSettingsContent({
  outputFolder,
  renderTimeoutSeconds,
  renderDefaultCpuUsage,
  renderDefaultGpuBackend,
  renderDefaultHardwareAcceleration,
  settingsLoading,
  browseOutputFolder,
  setRenderTimeoutSeconds,
  setRenderDefaultCpuUsage,
  setRenderDefaultGpuBackend,
  setRenderDefaultHardwareAcceleration,
}: {
  outputFolder: string;
  renderTimeoutSeconds: number;
  renderDefaultCpuUsage: RenderCpuUsage;
  renderDefaultGpuBackend: RenderGpuBackend;
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  settingsLoading: boolean;
  browseOutputFolder: () => void;
  setRenderTimeoutSeconds: (seconds: number) => Promise<boolean>;
  setRenderDefaultCpuUsage: (value: RenderCpuUsage) => Promise<boolean>;
  setRenderDefaultGpuBackend: (value: RenderGpuBackend) => Promise<boolean>;
  setRenderDefaultHardwareAcceleration: (value: RenderHardwareAcceleration) => Promise<boolean>;
}) {
  const truncatePath = (p: string, maxLen = 40) => {
    if (p.length <= maxLen) return p;
    const start = p.slice(0, 15);
    const end = p.slice(-22);
    return `${start}...${end}`;
  };

  return (
    <>
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

      {/* Image models folder controls moved to the dedicated "AI Models" screen. */}

      <SectionHeader>About</SectionHeader>
      <AppInfoSection />
    </>
  );
}
