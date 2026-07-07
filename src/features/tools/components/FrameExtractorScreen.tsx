import { useFrameExtractor } from '../hooks/useFrameExtractor';
import { FrameExtractorDropZone } from './FrameExtractorDropZone';
import { FrameExtractorConfig } from './FrameExtractorConfig';
import { FrameExtractorResults } from './FrameExtractorResults';
import { ProgressBar } from '@shared/components';

interface FrameExtractorScreenProps {
  onBack: () => void;
}

export function FrameExtractorScreen({ onBack }: FrameExtractorScreenProps) {
  const {
    phase,
    videoInfo,
    fps,
    preset,
    everyXSeconds,
    outputFormat,
    progress,
    frames,
    error,
    estimatedFrames,
    selectFile,
    loadVideo,
    setFps,
    setPreset,
    setEveryXSeconds,
    setOutputFormat,
    extract,
    cancel,
    saveAllAsZip,
    saveFrame,
    reset,
  } = useFrameExtractor();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0 gap-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3.5L5 7L8.5 10.5" />
          </svg>
          Tools
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-[13px] font-medium text-text-secondary">
          Frame Extractor
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Idle — Drop zone */}
        {phase === 'idle' && (
          <div className="h-full p-6 flex items-center justify-center">
            <div className="w-full max-w-[480px]">
              <FrameExtractorDropZone
                onFileDrop={loadVideo}
                onBrowse={selectFile}
              />
            </div>
          </div>
        )}

        {/* Configuring */}
        {phase === 'configuring' && videoInfo && (
          <div className="h-full p-6 flex items-start justify-center overflow-auto">
            <FrameExtractorConfig
              videoName={videoInfo.name}
              videoDuration={videoInfo.duration}
              videoFps={videoInfo.fps}
              videoWidth={videoInfo.width}
              videoHeight={videoInfo.height}
              fps={fps}
              preset={preset}
              everyXSeconds={everyXSeconds}
              outputFormat={outputFormat}
              estimatedFrames={estimatedFrames}
              onFpsChange={setFps}
              onPresetChange={setPreset}
              onEveryXSecondsChange={setEveryXSeconds}
              onOutputFormatChange={setOutputFormat}
              onExtract={extract}
              onChangeVideo={reset}
            />
          </div>
        )}

        {/* Extracting / Probing / Reading */}
        {(phase === 'extracting' || phase === 'probing' || phase === 'reading') && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 w-full max-w-[400px]">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-text-primary font-medium">
                {progress?.message ?? 'Processing...'}
              </p>
              <div className="w-full">
                <ProgressBar value={progress?.percent ?? 0} color="purple" />
              </div>
              {progress && progress.totalFrames > 0 && (
                <p className="text-[11px] text-text-dim">
                  {progress.framesExtracted} / {progress.totalFrames} frames
                </p>
              )}
              <button
                onClick={cancel}
                className="mt-2 px-4 py-1.5 rounded-[5px] text-[11px] text-text-muted hover:text-accent-red bg-app-surface hover:bg-app-hover transition-colors"
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Complete — Results Grid */}
        {phase === 'complete' && (
          <FrameExtractorResults
            frames={frames}
            onSaveAll={saveAllAsZip}
            onSaveFrame={saveFrame}
            onNewExtraction={reset}
          />
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 max-w-[400px]">
              <svg
                width="36" height="36" viewBox="0 0 36 36" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-accent-red"
              >
                <circle cx="18" cy="18" r="14" />
                <path d="M18 12V20" />
                <circle cx="18" cy="24" r="0.5" fill="currentColor" />
              </svg>
              <p className="text-[13px] text-accent-red font-medium">Extraction failed</p>
              <p className="text-[11px] text-text-muted text-center">{error}</p>
              <button
                onClick={reset}
                className="mt-2 text-[12px] text-accent hover:text-accent-light transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
