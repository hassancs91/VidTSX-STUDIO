import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useWhisper } from '../../hooks/useWhisper';
import { GeneralTab } from './tabs/GeneralTab';
import { ProvidersTab } from './tabs/ProvidersTab';
import { TranscriptionTab } from './tabs/TranscriptionTab';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'AI Providers' },
  { id: 'transcription', label: 'Whisper AI' },
  // Hidden for beta: re-enable when preset authoring ships
  // { id: 'presets', label: 'Presets' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const { outputFolder, aiModelsFolder, whisperModel, renderTimeoutSeconds, renderDefaultCpuUsage, renderDefaultGpuBackend, renderDefaultHardwareAcceleration, browseOutputFolder, browseAiModelsFolder, setWhisperModel, setRenderTimeoutSeconds, setRenderDefaultCpuUsage, setRenderDefaultGpuBackend, setRenderDefaultHardwareAcceleration, loading: settingsLoading } = useSettings();
  const {
    loading: whisperLoading,
    binaryStatus,
    models,
    downloads: whisperDownloads,
    error: whisperError,
    installBinary,
    downloadModel,
    pauseDownload: pauseWhisperDownload,
    resumeDownload: resumeWhisperDownload,
    cancelDownload: cancelWhisperDownload,
    deleteModel,
    clearError: clearWhisperError,
  } = useWhisper();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">
          Settings
        </span>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-3 h-[36px] bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 h-[28px] rounded-md text-[12px] font-medium transition-colors duration-150
              ${
                activeTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-app-base p-4">
        <div className={activeTab === 'general' || activeTab === 'transcription' ? 'max-w-[500px]' : ''}>
          {activeTab === 'general' && (
            <GeneralTab
              outputFolder={outputFolder}
              aiModelsFolder={aiModelsFolder}
              renderTimeoutSeconds={renderTimeoutSeconds}
              renderDefaultCpuUsage={renderDefaultCpuUsage}
              renderDefaultGpuBackend={renderDefaultGpuBackend}
              renderDefaultHardwareAcceleration={renderDefaultHardwareAcceleration}
              settingsLoading={settingsLoading}
              browseOutputFolder={browseOutputFolder}
              browseAiModelsFolder={browseAiModelsFolder}
              setRenderTimeoutSeconds={setRenderTimeoutSeconds}
              setRenderDefaultCpuUsage={setRenderDefaultCpuUsage}
              setRenderDefaultGpuBackend={setRenderDefaultGpuBackend}
              setRenderDefaultHardwareAcceleration={setRenderDefaultHardwareAcceleration}
            />
          )}
          {activeTab === 'providers' && <ProvidersTab />}
          {activeTab === 'transcription' && (
            <TranscriptionTab
              whisperModel={whisperModel}
              settingsLoading={settingsLoading}
              setWhisperModel={setWhisperModel}
              whisperLoading={whisperLoading}
              binaryStatus={binaryStatus}
              models={models}
              downloads={whisperDownloads}
              error={whisperError}
              installBinary={installBinary}
              downloadModel={downloadModel}
              pauseDownload={pauseWhisperDownload}
              resumeDownload={resumeWhisperDownload}
              cancelDownload={cancelWhisperDownload}
              deleteModel={deleteModel}
              clearError={clearWhisperError}
            />
          )}
          {/* Hidden for beta: re-enable alongside the 'presets' tab in TABS */}
          {/* {activeTab === 'presets' && <PresetsTab />} */}
        </div>
      </div>
    </div>
  );
}
