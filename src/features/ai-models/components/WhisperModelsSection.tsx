import { Button, Panel, ProgressBar, SectionHeader, StatusBadge } from '@shared/components';
import { Select } from '@shared/components/Select';
import { useWhisper } from '@renderer/hooks/useWhisper';
import { useSettings } from '@renderer/hooks/useSettings';

function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function WhisperModelsSection() {
  const { whisperModel, setWhisperModel, loading: settingsLoading } = useSettings();
  const {
    loading: whisperLoading,
    binaryStatus,
    models,
    downloads,
    error,
    installBinary,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    clearError,
  } = useWhisper();

  const downloadedModels = models.filter((m) => m.downloaded);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 items-start">
        <div>
          <SectionHeader>Engine</SectionHeader>
          <Panel className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-secondary">whisper.cpp binary</span>
                <StatusBadge tone={binaryStatus.installed ? 'success' : 'error'}>
                  {binaryStatus.installed ? 'Installed' : 'Not installed'}
                </StatusBadge>
              </div>
              {!binaryStatus.installed && !binaryStatus.installing && (
                <Button variant="primary" onClick={installBinary}>Install</Button>
              )}
            </div>

            {binaryStatus.installing && (
              <div className="mt-3">
                <div className="text-[11px] text-text-muted mb-1">Downloading whisper.cpp...</div>
                <ProgressBar value={binaryStatus.progress} />
              </div>
            )}

            {binaryStatus.error && (
              <div className="mt-2 text-[11px] text-accent-red">{binaryStatus.error}</div>
            )}

            {binaryStatus.installed && (
              <div className="mt-2 text-[10px] text-text-dim font-mono break-all select-all cursor-text">
                {binaryStatus.path}
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-6 md:mt-0">
          <SectionHeader>Default model</SectionHeader>
          <Panel className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-text-muted">Model used for transcription</div>
              <Select
                value={whisperModel}
                onChange={setWhisperModel}
                disabled={settingsLoading}
                options={
                  downloadedModels.length === 0
                    ? [{ value: whisperModel, label: `${whisperModel} (not downloaded)` }]
                    : downloadedModels.map((m) => ({ value: m.id, label: m.name }))
                }
                className="min-w-[180px]"
              />
            </div>
          </Panel>
        </div>
      </div>

      <SectionHeader>Models</SectionHeader>
      <Panel>
        {whisperLoading ? (
          <div className="p-3 text-[12px] text-text-muted">Loading models...</div>
        ) : (
          models.map((model, index) => {
            const dl = downloads[model.id];
            return (
              <div
                key={model.id}
                className={`p-3 ${index !== models.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[12px] text-text-secondary">{model.name}</span>
                    <span className="text-[11px] text-text-dim ml-2">— {model.size}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {model.downloaded ? (
                      <>
                        <StatusBadge tone="success">Downloaded</StatusBadge>
                        <Button
                          variant="secondary"
                          onClick={() => deleteModel(model.id)}
                          className="!text-accent-red hover:!text-accent-red"
                        >
                          Delete
                        </Button>
                      </>
                    ) : dl ? (
                      <div className="flex items-center gap-2">
                        {dl.status === 'paused' ? (
                          <Button variant="secondary" onClick={() => resumeDownload(model.id)}>
                            Resume
                          </Button>
                        ) : (
                          <Button variant="secondary" onClick={() => pauseDownload(model.id)}>
                            Pause
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() => cancelDownload(model.id)}
                          className="!text-accent-red hover:!text-accent-red"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => downloadModel(model.id)}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>

                {dl && (
                  <div className="mt-2">
                    <ProgressBar value={dl.progress} />
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-text-dim">
                      <span>{Math.round(dl.progress)}%</span>
                      {dl.status === 'paused' ? (
                        <span>Paused</span>
                      ) : dl.status === 'extracting' ? (
                        <span>Extracting...</span>
                      ) : dl.status === 'queued' ? (
                        <span>Queued</span>
                      ) : (
                        <>
                          {dl.speedBps > 0 && <span>{formatSpeed(dl.speedBps)}</span>}
                          {dl.etaSeconds > 0 && <span>ETA {formatEta(dl.etaSeconds)}</span>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {error && (
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-[11px] text-accent-red">{error}</span>
            <button
              onClick={clearError}
              className="text-[10px] text-text-dim hover:text-text-muted"
            >
              Dismiss
            </button>
          </div>
        )}
      </Panel>
    </>
  );
}
