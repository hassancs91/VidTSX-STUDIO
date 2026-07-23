import { Modal } from '@shared/components';
import { useSettings } from '../../hooks/useSettings';
import { GeneralSettingsContent } from './GeneralSettingsContent';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    outputFolder,
    renderTimeoutSeconds,
    renderDefaultCpuUsage,
    renderDefaultGpuBackend,
    renderDefaultHardwareAcceleration,
    browseOutputFolder,
    setRenderTimeoutSeconds,
    setRenderDefaultCpuUsage,
    setRenderDefaultGpuBackend,
    setRenderDefaultHardwareAcceleration,
    loading: settingsLoading,
  } = useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      {/* Shared Modal has no scroll handling of its own — constrain and scroll here. */}
      <div className="w-[520px] max-w-[90vw] max-h-[70vh] overflow-y-auto pr-1">
        <GeneralSettingsContent
          outputFolder={outputFolder}
          renderTimeoutSeconds={renderTimeoutSeconds}
          renderDefaultCpuUsage={renderDefaultCpuUsage}
          renderDefaultGpuBackend={renderDefaultGpuBackend}
          renderDefaultHardwareAcceleration={renderDefaultHardwareAcceleration}
          settingsLoading={settingsLoading}
          browseOutputFolder={browseOutputFolder}
          setRenderTimeoutSeconds={setRenderTimeoutSeconds}
          setRenderDefaultCpuUsage={setRenderDefaultCpuUsage}
          setRenderDefaultGpuBackend={setRenderDefaultGpuBackend}
          setRenderDefaultHardwareAcceleration={setRenderDefaultHardwareAcceleration}
        />
      </div>
    </Modal>
  );
}
