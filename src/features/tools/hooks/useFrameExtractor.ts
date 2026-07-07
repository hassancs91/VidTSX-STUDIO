import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  VideoInfo,
  FrameExtractorPhase,
  ExtractedFrame,
  FrameExtractionPreset,
  FrameExtractProgressEvent,
} from '../types';

interface FrameExtractorState {
  phase: FrameExtractorPhase;
  videoInfo: VideoInfo | null;
  fps: number;
  preset: FrameExtractionPreset;
  everyXSeconds: number;
  outputFormat: 'png' | 'jpg';
  progress: FrameExtractProgressEvent | null;
  frames: ExtractedFrame[];
  outputDir: string | null;
  error: string | null;
}

const initialState: FrameExtractorState = {
  phase: 'idle',
  videoInfo: null,
  fps: 1,
  preset: 'custom',
  everyXSeconds: 1,
  outputFormat: 'png',
  progress: null,
  frames: [],
  outputDir: null,
  error: null,
};

export function useFrameExtractor() {
  const [state, setState] = useState<FrameExtractorState>(initialState);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const loadVideo = useCallback(async (filePath: string) => {
    setState((s) => ({ ...s, phase: 'configuring', error: null }));
    try {
      const result = await window.api.studioFfprobe({ filePath });
      if (!result.success || !result.metadata) {
        setState((s) => ({
          ...s,
          phase: 'error',
          error: result.error ?? 'Failed to read video metadata',
        }));
        return;
      }
      const m = result.metadata;
      setState((s) => ({
        ...s,
        phase: 'configuring',
        videoInfo: {
          path: m.filePath,
          name: m.fileName,
          duration: m.durationInSeconds,
          fps: m.fps,
          width: m.width,
          height: m.height,
        },
        fps: 1,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const selectFile = useCallback(async () => {
    const result = await window.api.dialogOpen({
      filters: [{
        name: 'Video Files',
        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'gif', 'wmv', 'flv'],
      }],
      multiSelections: false,
    });
    if (!result.canceled && result.filePaths.length > 0) {
      await loadVideo(result.filePaths[0]);
    }
  }, [loadVideo]);

  const setFps = useCallback((fps: number) => {
    setState((s) => ({ ...s, fps }));
  }, []);

  const setPreset = useCallback((preset: FrameExtractionPreset) => {
    setState((s) => ({ ...s, preset }));
  }, []);

  const setEveryXSeconds = useCallback((everyXSeconds: number) => {
    setState((s) => ({ ...s, everyXSeconds }));
  }, []);

  const setOutputFormat = useCallback((outputFormat: 'png' | 'jpg') => {
    setState((s) => ({ ...s, outputFormat }));
  }, []);

  const extract = useCallback(async () => {
    if (!state.videoInfo) return;

    setState((s) => ({ ...s, phase: 'extracting', progress: null, error: null, frames: [] }));

    const cleanup = window.api.onToolsFrameExtractProgress((progress) => {
      setState((s) => ({ ...s, phase: progress.phase, progress }));
    });
    cleanupRef.current = cleanup;

    try {
      const result = await window.api.toolsFrameExtract({
        videoPath: state.videoInfo.path,
        fps: state.fps,
        preset: state.preset,
        everyXSeconds: state.everyXSeconds,
        outputFormat: state.outputFormat,
      });

      cleanup();
      cleanupRef.current = null;

      if (result.success && result.frames) {
        setState((s) => ({
          ...s,
          phase: 'complete',
          frames: result.frames ?? [],
          outputDir: result.outputDir ?? null,
        }));
      } else {
        setState((s) => ({
          ...s,
          phase: 'error',
          error: result.error ?? 'Extraction failed',
        }));
      }
    } catch (err) {
      cleanup();
      cleanupRef.current = null;
      setState((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.videoInfo, state.fps, state.preset, state.everyXSeconds, state.outputFormat]);

  const cancel = useCallback(async () => {
    await window.api.toolsFrameExtractCancel();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState((s) => ({ ...s, phase: 'configuring', progress: null }));
  }, []);

  const saveAllAsZip = useCallback(async () => {
    if (state.frames.length === 0) return;
    const framePaths = state.frames.map((f) => f.filePath);
    const videoName = state.videoInfo?.name?.replace(/\.[^.]+$/, '') ?? 'frames';
    await window.api.toolsFrameSaveZip({
      framePaths,
      defaultName: `${videoName}-frames.zip`,
    });
  }, [state.frames, state.videoInfo]);

  const saveFrame = useCallback(async (frame: ExtractedFrame) => {
    await window.api.toolsFrameSaveSingle({
      framePath: frame.filePath,
      defaultName: frame.fileName,
    });
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState(initialState);
  }, []);

  const estimatedFrames = state.videoInfo
    ? (() => {
        const d = state.videoInfo.duration;
        switch (state.preset) {
          case 'first-frame':
          case 'last-frame':
            return 1;
          case 'every-x-seconds':
            return Math.max(1, Math.ceil(d / state.everyXSeconds));
          case 'custom':
          default:
            return Math.max(1, Math.ceil(d * state.fps));
        }
      })()
    : 0;

  return {
    ...state,
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
  };
}
