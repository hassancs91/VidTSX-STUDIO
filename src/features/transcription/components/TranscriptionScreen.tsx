import { Button, ProgressBar } from '@shared/components';
import { useTranscription, type EngineChoice } from '../hooks/useTranscription';
import { useTranscriptionProjects } from '../hooks/useTranscriptionProjects';
import { TranscriptViewer } from './TranscriptViewer';
import { WHISPER_LANGUAGES, CLOUD_LANGUAGES } from '../types';
import { useToast } from '@renderer/contexts/ToastContext';

// Jump to the AI Models screen (cross-screen nav handled in App.tsx).
function goToAiModels() {
  window.dispatchEvent(new CustomEvent('vidtsx:navigate', { detail: { screen: 'ai-models' } }));
}

const selectClass = 'w-full rounded-md px-2 py-1.5 text-[12px] text-text-secondary cursor-pointer';
const selectStyle = {
  backgroundColor: 'var(--color-app-surface)',
  border: '1px solid var(--color-border)',
} as const;

// Icons
const MicrophoneIcon = () => (
  <svg
    width={48}
    height={48}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="16" y="6" width="16" height="24" rx="8" />
    <path d="M10 24C10 32 16.3 38 24 38C31.7 38 38 32 38 24" />
    <path d="M24 38V44" />
    <path d="M16 44H32" />
  </svg>
);

const FileIcon = () => (
  <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M12 2v4h4" />
  </svg>
);

// Format duration for project list
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TranscriptionScreen() {
  const { showToast } = useToast();
  const {
    state,
    selectedFile,
    engine,
    selectedModel,
    cloudModelId,
    cloudEntry,
    cloudEntries,
    detectSpeakers,
    supportsSpeakers,
    selectedLanguage,
    downloadedModels,
    whisperReady,
    cloudKeyPresent,
    selectFile,
    handleFileDrop,
    setEngine,
    setSelectedModel,
    setCloudModelId,
    setDetectSpeakers,
    setSelectedLanguage,
    transcribe,
    cancel,
    loadProject,
    exportAs,
    copyToClipboard,
    resetToIdle,
    resetFull,
    canTranscribe,
    isProcessing,
    hasResult,
  } = useTranscription();

  const { projects, refresh: refreshProjects, deleteProject } = useTranscriptionProjects();

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0] as unknown as { path: string };
      if (file.path) {
        const error = handleFileDrop(file.path);
        if (error) {
          showToast(error, 'error');
        }
      }
    }
  };

  // After transcription completes, refresh project list
  const handleTranscribe = async () => {
    await transcribe();
    refreshProjects();
  };

  const handleLoadProject = async (id: string) => {
    await loadProject(id);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Transcription</span>
        {hasResult && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetToIdle}>
              Re-transcribe
            </Button>
            <Button variant="secondary" onClick={resetFull}>
              New transcription
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Input & Controls */}
        <div
          className="w-[320px] shrink-0 p-4 bg-app-base overflow-y-auto"
          style={{ borderRight: '0.5px solid var(--color-border)' }}
        >
          {/* Engine selector — Local Whisper vs BYOK cloud providers */}
          <div className="mb-4">
            <label className="block text-[11px] text-text-muted mb-1.5">Engine</label>
            <div
              className="flex rounded-md p-0.5"
              style={{ backgroundColor: 'var(--color-app-surface)', border: '1px solid var(--color-border)' }}
            >
              {([
                { id: 'whisper', label: 'Local · Whisper' },
                { id: 'cloud', label: 'Cloud' },
              ] as { id: EngineChoice; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  disabled={isProcessing}
                  onClick={() => setEngine(opt.id)}
                  className={`flex-1 text-[11px] py-1 rounded transition-colors ${
                    engine === opt.id
                      ? 'bg-app-hover text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Whisper not installed warning */}
          {engine === 'whisper' && !whisperReady && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(239, 159, 39, 0.1)',
                border: '1px solid rgba(239, 159, 39, 0.3)',
              }}
            >
              <div className="text-[12px] text-accent-amber">
                Whisper is not installed. Install it from the AI Models screen (Audio tab).
              </div>
            </div>
          )}

          {/* Cloud provider key missing warning */}
          {engine === 'cloud' && !cloudKeyPresent && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(239, 159, 39, 0.1)',
                border: '1px solid rgba(239, 159, 39, 0.3)',
              }}
            >
              <div className="text-[12px] text-accent-amber mb-2">
                No {cloudEntry?.provider === 'openrouter' ? 'OpenRouter' : 'AssemblyAI'} API key
                configured. Add it in AI Models → Providers to use cloud transcription.
              </div>
              <Button variant="secondary" onClick={goToAiModels}>
                Open AI Models
              </Button>
            </div>
          )}

          {/* Recent Transcriptions */}
          {projects.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-text-muted mb-2">Recent Transcriptions</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-app-hover transition-colors group"
                    onClick={() => handleLoadProject(p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-text-secondary truncate">{p.name}</div>
                      <div className="text-[9px] text-text-dim">
                        {p.language} &middot; {formatDuration(p.duration)} &middot; {p.segmentCount} segments
                      </div>
                    </div>
                    <button
                      className="text-text-dim hover:text-accent-red shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[14px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(p.id);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone / File info */}
          {!selectedFile ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-accent"
              style={{ borderColor: 'var(--color-border)' }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={selectFile}
            >
              <div className="flex justify-center mb-3 text-text-dim">
                <MicrophoneIcon />
              </div>
              <div className="text-[13px] text-text-secondary mb-1">
                Drop a video or audio file here
              </div>
              <div className="text-[11px] text-text-dim">or click to browse</div>
            </div>
          ) : (
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: 'var(--color-app-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-text-muted">
                  <FileIcon />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] text-text-secondary truncate"
                    title={selectedFile.path}
                  >
                    {selectedFile.name}
                  </div>
                  <div className="text-[10px] text-text-dim uppercase">{selectedFile.type}</div>
                </div>
                {!isProcessing && (
                  <Button variant="secondary" onClick={selectFile}>
                    Change
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Model selector — Whisper local models */}
          {selectedFile && engine === 'whisper' && (
            <div className="mt-4">
              <label className="block text-[11px] text-text-muted mb-1">Model</label>
              <select
                className={selectClass}
                style={selectStyle}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isProcessing || downloadedModels.length === 0}
              >
                {downloadedModels.length === 0 ? (
                  <option value="">No models downloaded</option>
                ) : (
                  downloadedModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.size})
                    </option>
                  ))
                )}
              </select>
              {downloadedModels.length === 0 && (
                <div className="text-[10px] text-text-dim mt-1">
                  Download a model in AI Models &rarr; Audio to start transcribing
                </div>
              )}
            </div>
          )}

          {/* Model selector — cloud models (AssemblyAI / OpenRouter) */}
          {selectedFile && engine === 'cloud' && (
            <div className="mt-4">
              <label className="block text-[11px] text-text-muted mb-1">Model</label>
              <select
                className={selectClass}
                style={selectStyle}
                value={cloudModelId}
                onChange={(e) => setCloudModelId(e.target.value)}
                disabled={isProcessing}
              >
                {cloudEntries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.priceText ? ` · ${m.priceText}` : ''}
                  </option>
                ))}
              </select>
              {cloudEntry && !cloudEntry.features.wordTimestamps && (
                <div className="text-[10px] text-text-dim mt-1">
                  Plain text only — no word timestamps (not usable for captions)
                </div>
              )}
            </div>
          )}

          {/* Detect speakers toggle — diarizing cloud models only */}
          {selectedFile && engine === 'cloud' && (
            <div className="mt-3">
              <label
                className={`flex items-center gap-2 text-[12px] ${
                  supportsSpeakers ? 'text-text-secondary cursor-pointer' : 'text-text-dim cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={detectSpeakers}
                  disabled={isProcessing || !supportsSpeakers}
                  onChange={(e) => setDetectSpeakers(e.target.checked)}
                />
                Detect speakers
              </label>
              {!supportsSpeakers && (
                <div className="text-[10px] text-text-dim mt-1">
                  Available on AssemblyAI models
                </div>
              )}
            </div>
          )}

          {/* Language selector */}
          {selectedFile && (
            <div className="mt-3">
              <label className="block text-[11px] text-text-muted mb-1">Language</label>
              <select
                className={selectClass}
                style={selectStyle}
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isProcessing}
              >
                {(engine === 'cloud'
                  ? (CLOUD_LANGUAGES as readonly { code: string; name: string }[])
                  : (WHISPER_LANGUAGES as readonly { code: string; name: string }[])
                ).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-muted capitalize">{state.phase}</span>
                <span className="text-text-dim">{state.progress}%</span>
              </div>
              <ProgressBar value={state.progress} />
              {state.message && <div className="text-[10px] text-text-dim mt-1">{state.message}</div>}
            </div>
          )}

          {/* Error */}
          {state.error && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(240, 149, 149, 0.1)',
                border: '1px solid rgba(240, 149, 149, 0.3)',
              }}
            >
              <div className="text-[11px] text-accent-red">{state.error}</div>
            </div>
          )}

          {/* Action button */}
          {selectedFile && !hasResult && (
            <div className="mt-4">
              {isProcessing ? (
                <Button variant="secondary" onClick={cancel} className="w-full">
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleTranscribe}
                  disabled={!canTranscribe}
                  className="w-full"
                >
                  Transcribe
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Transcript viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {hasResult ? (
            <TranscriptViewer result={state.result!} onExport={exportAs} onCopy={copyToClipboard} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-dim">
              <div className="text-center">
                <div className="text-[13px]">
                  {selectedFile ? 'Click "Transcribe" to start' : 'Select a file to begin'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
