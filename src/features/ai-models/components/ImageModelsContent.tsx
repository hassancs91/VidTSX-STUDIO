import { useState } from 'react';
import { ProgressBar } from '@shared/components';
import { useSdImageModels } from '../../../renderer/hooks/useSdImageModels';

// ─── Icons ────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7L5.5 10.5L12 4" />
  </svg>
);

const XIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3L11 11M11 3L3 11" />
  </svg>
);

const DownloadIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5M2 10h8" />
  </svg>
);

const TrashIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h8M4.5 3V2h3v1M3 3v7h6V3" />
  </svg>
);

const PauseIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor">
    <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
    <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
  </svg>
);

const PlayIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor">
    <path d="M2 1.5L8.5 5L2 8.5V1.5Z" />
  </svg>
);

const CancelIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
    <path d="M2 2L8 8M8 2L2 8" />
  </svg>
);

// ─── Formatters ───────────────────────────────────────────────────

function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 0) return '';
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// ─── Grid columns ─────────────────────────────────────────────────

const GRID_COLUMNS = '1fr 80px 80px 140px';

// ─── Component ────────────────────────────────────────────────────

export function ImageModelsContent() {
  const {
    models,
    loading,
    cliStatus,
    downloads,
    activeCount,
    activeModelId,
    error,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    setActiveModel,
    clearError,
  } = useSdImageModels();

  const MAX_CONCURRENT = 3;
  const [search, setSearch] = useState('');
  const downloadedCount = models.filter((m) => m.downloaded).length;
  const query = search.trim().toLowerCase();
  const filtered = query
    ? models.filter((m) => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query) || m.family.toLowerCase().includes(query))
    : models;

  return (
    <>
      {/* Status banner */}
      <div className="bg-app-surface rounded-lg p-3 border border-border mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {cliStatus.installed ? (
                <>
                  <span className="text-accent-green"><CheckIcon /></span>
                  <span className="text-[12px] text-text-secondary">Engine ready</span>
                </>
              ) : (
                <>
                  <span className="text-accent-red"><XIcon /></span>
                  <span className="text-[12px] text-text-secondary">Binary not found</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-text-dim">
              {downloadedCount} / {models.length} models downloaded
            </span>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-app-base border border-border rounded px-2 py-1 text-[11px] text-text-secondary placeholder:text-text-dim outline-none focus:border-accent w-[180px]"
          />
        </div>
      </div>

      {/* Models table */}
      <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div
          className="grid items-center px-3 h-[32px] text-[10px] font-medium text-text-dim uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID_COLUMNS, borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span>Model</span>
          <span>Family</span>
          <span>Size</span>
          <span className="text-right">Status</span>
        </div>

        {loading ? (
          <div className="p-4 text-[12px] text-text-muted text-center">Loading models...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-text-muted text-center">
            {query ? 'No models match your search' : 'No models available'}
          </div>
        ) : (
          filtered.map((model, index) => (
            <div
              key={model.id}
              className={`grid items-center px-3 h-[40px] hover:bg-app-hover transition-colors ${
                index !== filtered.length - 1 ? 'border-b border-border' : ''
              }`}
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              {/* Name + ID */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-text-secondary truncate">{model.name}</span>
                  {activeModelId === model.id && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent/15 text-accent-light">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-text-dim font-mono truncate">{model.id}</div>
              </div>

              {/* Family badge */}
              <span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">
                  {model.family.toUpperCase()}
                </span>
              </span>

              {/* Size */}
              <span className="text-[11px] text-text-muted">{model.sizeLabel}</span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5">
                {model.downloaded ? (
                  <>
                    {activeModelId !== model.id && (
                      <button
                        onClick={() => setActiveModel(model.id)}
                        className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-light hover:bg-app-hover transition-colors"
                        title="Set as active model"
                      >
                        Use
                      </button>
                    )}
                    <span className="flex items-center text-accent-green">
                      <CheckIcon />
                    </span>
                    <button
                      onClick={() => deleteModel(model.id)}
                      className="flex items-center justify-center w-[24px] h-[24px] rounded text-text-dim hover:text-accent-red hover:bg-app-hover transition-colors"
                      title="Delete model"
                    >
                      <TrashIcon />
                    </button>
                  </>
                ) : downloads[model.id] ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-[60px]">
                      <div className="text-[9px] text-text-dim text-right mb-0.5">
                        {downloads[model.id].status === 'extracting'
                          ? 'Extracting...'
                          : downloads[model.id].status === 'paused'
                            ? 'Paused'
                            : `${downloads[model.id].progress}%`}
                      </div>
                      <ProgressBar value={downloads[model.id].progress} />
                      {downloads[model.id].speedBps > 0 && downloads[model.id].status === 'downloading' && (
                        <div className="text-[8px] text-text-dim text-right mt-0.5">
                          {formatSpeed(downloads[model.id].speedBps)}
                          {downloads[model.id].etaSeconds > 0 && ` · ${formatEta(downloads[model.id].etaSeconds)}`}
                        </div>
                      )}
                    </div>
                    {downloads[model.id].status === 'downloading' && (
                      <button
                        onClick={() => pauseDownload(model.id)}
                        className="flex items-center justify-center w-[20px] h-[20px] rounded text-text-dim hover:text-accent-light hover:bg-app-hover transition-colors"
                        title="Pause"
                      >
                        <PauseIcon />
                      </button>
                    )}
                    {downloads[model.id].status === 'paused' && (
                      <button
                        onClick={() => resumeDownload(model.id)}
                        className="flex items-center justify-center w-[20px] h-[20px] rounded text-text-dim hover:text-accent-light hover:bg-app-hover transition-colors"
                        title="Resume"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    {(downloads[model.id].status === 'downloading' || downloads[model.id].status === 'paused') && (
                      <button
                        onClick={() => cancelDownload(model.id)}
                        className="flex items-center justify-center w-[20px] h-[20px] rounded text-text-dim hover:text-accent-red hover:bg-app-hover transition-colors"
                        title="Cancel"
                      >
                        <CancelIcon />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => downloadModel(model.id)}
                    disabled={activeCount >= MAX_CONCURRENT || !cliStatus.installed}
                    className={`flex items-center gap-1 px-2 h-[24px] rounded text-[10px] font-medium transition-colors ${
                      activeCount >= MAX_CONCURRENT || !cliStatus.installed
                        ? 'text-text-dim cursor-not-allowed'
                        : 'text-accent-light hover:bg-app-hover'
                    }`}
                    title={!cliStatus.installed ? 'Install sd-cli first' : activeCount >= MAX_CONCURRENT ? `Max ${MAX_CONCURRENT} downloads at once` : 'Download model'}
                  >
                    <DownloadIcon />
                    Download
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="px-3 py-2 text-[11px] text-accent-red border-t border-border flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-text-dim hover:text-text-secondary ml-2">
              <CancelIcon />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
