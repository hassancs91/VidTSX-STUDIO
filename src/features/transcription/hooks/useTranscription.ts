import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TranscriptionState,
  FileInfo,
  ExportFormat,
  TranscriptResult,
  TranscriptionProjectData,
  TranscribeEngine,
  SttCatalogEntry,
} from '../types';
import type {
  WhisperModel,
  WhisperProgressEvent,
  DownloadProgressEvent,
  SttTranscribeProgressEvent,
} from '@shared/ipc/types';
import {
  ACCEPTED_MEDIA_EXTENSIONS,
  isAudioExtension,
  STT_CATALOG,
  findSttEntry,
  coerceSttEntry,
} from '../types';
import { exportTranscript } from '../services/export-transcript';

const initialState: TranscriptionState = {
  phase: 'idle',
  progress: 0,
  message: '',
  result: null,
  error: null,
};

/** UI engine groups: local whisper vs bring-your-own-key cloud providers. */
export type EngineChoice = 'whisper' | 'cloud';

const CLOUD_ENTRIES: SttCatalogEntry[] = STT_CATALOG.filter(
  (e) => e.provider !== 'local-whisper',
);
const DEFAULT_CLOUD_MODEL = CLOUD_ENTRIES[0]?.id ?? 'assemblyai/universal';

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>(initialState);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [engine, setEngine] = useState<EngineChoice>('whisper');
  const [selectedModel, setSelectedModel] = useState<string>('base');
  const [cloudModelId, setCloudModelId] = useState<string>(DEFAULT_CLOUD_MODEL);
  const [detectSpeakers, setDetectSpeakers] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [whisperReady, setWhisperReady] = useState(false);
  const [hasKeys, setHasKeys] = useState({ fal: false, openrouter: false, assemblyai: false });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // The currently-selected cloud entry and whether it supports speaker labels.
  const cloudEntry = findSttEntry(cloudModelId);
  const supportsSpeakers = cloudEntry?.features.speakerLabels ?? false;
  const cloudKeyPresent =
    cloudEntry?.provider === 'assemblyai' ? hasKeys.assemblyai :
    cloudEntry?.provider === 'openrouter' ? hasKeys.openrouter :
    false;

  // Speaker detection only applies to models that diarize — turn it off when
  // the user switches to one that doesn't support it.
  useEffect(() => {
    if (!supportsSpeakers && detectSpeakers) setDetectSpeakers(false);
  }, [supportsSpeakers, detectSpeakers]);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const unsubBinaryRef = useRef<(() => void) | null>(null);
  const unsubDownloadRef = useRef<(() => void) | null>(null);
  const hasAutoSelectedRef = useRef(false);

  const refreshWhisperStatus = useCallback(async () => {
    try {
      const [binaryStatus, modelsResult] = await Promise.all([
        window.api.whisperBinaryStatus(),
        window.api.whisperModelsList(),
      ]);

      setWhisperReady(binaryStatus.installed);
      setModels(modelsResult.models);

      if (modelsResult.error) {
        setState((prev) => ({ ...prev, error: modelsResult.error! }));
      }

      // Auto-select first downloaded model only once (don't override user's choice)
      if (!hasAutoSelectedRef.current) {
        const downloadedModel = modelsResult.models.find((m) => m.downloaded);
        if (downloadedModel) {
          setSelectedModel(downloadedModel.id);
          hasAutoSelectedRef.current = true;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check Whisper status';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  // Load whisper status on mount
  useEffect(() => {
    refreshWhisperStatus();
  }, [refreshWhisperStatus]);

  // Cloud provider key availability (BYOK). Refreshed on mount; the Settings
  // screen is where keys change, and this screen re-checks per transcribe.
  const refreshKeys = useCallback(async () => {
    try {
      const res = await window.api.providerKeysGet();
      if (res.success) setHasKeys(res.hasKeys);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    refreshKeys();
  }, [refreshKeys]);

  // Stay in sync when whisper binary is installed elsewhere (e.g. Settings screen).
  // The transcribe screen stays mounted while hidden, so we can't rely on remount.
  useEffect(() => {
    unsubBinaryRef.current = window.api.onWhisperProgress((event: WhisperProgressEvent) => {
      if (event.type !== 'binary') return;
      // Binary install emits progress to 100 before extraction completes; give it a
      // brief moment to land on disk, then re-check from the source of truth.
      if (event.percent >= 100) {
        setTimeout(() => {
          refreshWhisperStatus();
        }, 1000);
      }
    });
    return () => {
      unsubBinaryRef.current?.();
    };
  }, [refreshWhisperStatus]);

  // Stay in sync when whisper models finish downloading elsewhere.
  useEffect(() => {
    unsubDownloadRef.current = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== 'whisper-model') return;
      if (event.status !== 'completed') return;

      const modelId = event.metadata.modelId;
      if (!modelId) return;

      setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, downloaded: true } : m)));
    });
    return () => {
      unsubDownloadRef.current?.();
    };
  }, []);

  // Subscribe to transcription progress (single channel for every engine).
  useEffect(() => {
    unsubscribeRef.current = window.api.onSttTranscribeProgress(
      (event: SttTranscribeProgressEvent) => {
        setState((prev) => ({
          ...prev,
          phase: event.phase,
          progress: event.percent,
          message: event.message || '',
        }));
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Select file via dialog
  const selectFile = useCallback(async () => {
    const result = await window.api.dialogOpen({
      filters: [
        {
          name: 'Media Files',
          extensions: [...ACCEPTED_MEDIA_EXTENSIONS],
        },
        { name: 'Video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = filePath.split(/[/\\]/).pop() || 'Unknown';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      setSelectedFile({
        path: filePath,
        name: fileName,
        size: 0,
        type: isAudioExtension(ext) ? 'audio' : 'video',
      });

      setState(initialState);
      setCurrentProjectId(null);
    }
  }, []);

  // Handle file drop — returns error string or null
  const handleFileDrop = useCallback((filePath: string): string | null => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Unknown';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (!ACCEPTED_MEDIA_EXTENSIONS.includes(ext as (typeof ACCEPTED_MEDIA_EXTENSIONS)[number])) {
      return `Unsupported file type: .${ext}`;
    }

    setSelectedFile({
      path: filePath,
      name: fileName,
      size: 0,
      type: isAudioExtension(ext) ? 'audio' : 'video',
    });

    setState(initialState);
    setCurrentProjectId(null);
    return null;
  }, []);

  // Persist a finished transcript as a project (best-effort).
  const saveProject = useCallback(
    async (file: FileInfo, result: TranscriptResult, usedEngine: TranscribeEngine, modelId: string) => {
      const projectId = currentProjectId || crypto.randomUUID();
      const project: TranscriptionProjectData = {
        id: projectId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        sourceFilePath: file.path,
        sourceFileName: file.name,
        sourceFileType: file.type,
        engine: usedEngine,
        modelId,
        language: result.language,
        result,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      try {
        await window.api.transcriptionProjectSave({ project });
      } catch {
        // Save is best-effort
      }
      setCurrentProjectId(projectId);
    },
    [currentProjectId]
  );

  // Start transcription — every engine flows through the same pipeline.
  const transcribe = useCallback(async () => {
    if (!selectedFile) return;

    let sttModelId: string;
    if (engine === 'whisper') {
      const model = models.find((m) => m.id === selectedModel);
      if (!model?.downloaded) {
        setState((prev) => ({
          ...prev,
          error: 'Selected model is not downloaded. Go to Settings to download it.',
        }));
        return;
      }
      sttModelId = `local-whisper/${selectedModel}`;
    } else {
      if (!cloudEntry) {
        setState((prev) => ({ ...prev, error: 'Select a cloud transcription model first.' }));
        return;
      }
      if (!cloudKeyPresent) {
        setState((prev) => ({
          ...prev,
          error: `No ${cloudEntry.provider === 'assemblyai' ? 'AssemblyAI' : 'OpenRouter'} API key configured. Add it in Settings to use cloud transcription.`,
        }));
        return;
      }
      sttModelId = cloudEntry.id;
    }

    setState({
      phase: 'extracting',
      progress: 0,
      message: 'Starting…',
      result: null,
      error: null,
    });

    try {
      const response = await window.api.sttTranscribeRun({
        inputPath: selectedFile.path,
        sttModelId,
        language: selectedLanguage,
        detectSpeakers,
      });

      if (response.success && response.result) {
        setState({
          phase: 'complete',
          progress: 100,
          message: 'Transcription complete',
          result: response.result,
          error: null,
        });
        const entry = findSttEntry(sttModelId);
        await saveProject(selectedFile, response.result, entry?.provider ?? 'local-whisper', sttModelId);
      } else {
        setState({
          phase: 'error',
          progress: 0,
          message: '',
          result: null,
          error: response.error || 'Transcription failed',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed unexpectedly';
      setState({
        phase: 'error',
        progress: 0,
        message: '',
        result: null,
        error: message,
      });
    }
  }, [
    selectedFile,
    engine,
    selectedModel,
    cloudEntry,
    cloudKeyPresent,
    detectSpeakers,
    selectedLanguage,
    models,
    saveProject,
  ]);

  // Cancel transcription (single pipeline, single cancel).
  const cancel = useCallback(async () => {
    try {
      await window.api.sttTranscribeCancel();
    } catch {
      // Cancel is best-effort
    }
    setState(initialState);
  }, []);

  // Load a saved project
  const loadProject = useCallback(async (id: string) => {
    try {
      const response = await window.api.transcriptionProjectLoad({ id });
      if (response.success && response.project) {
        const p = response.project;
        setCurrentProjectId(p.id);
        setSelectedFile({
          path: p.sourceFilePath,
          name: p.sourceFileName,
          size: 0,
          type: p.sourceFileType,
        });
        // Legacy mapping: 'whisper' → local model id as-is; 'vidtsx' (removed
        // provider) → keep the saved result readable on the default cloud model.
        const loadedEngine = p.engine ?? 'whisper';
        if (loadedEngine === 'whisper' || loadedEngine === 'local-whisper') {
          setEngine('whisper');
          setSelectedModel(p.modelId.startsWith('local-whisper/')
            ? p.modelId.slice('local-whisper/'.length)
            : p.modelId);
        } else if (loadedEngine === 'vidtsx') {
          setEngine('cloud');
          setCloudModelId(DEFAULT_CLOUD_MODEL);
        } else {
          setEngine('cloud');
          setCloudModelId(coerceSttEntry(p.modelId).id);
        }
        setSelectedLanguage(p.language === 'auto' || p.language === 'unknown' ? 'en' : p.language);
        setState({
          phase: 'complete',
          progress: 100,
          message: 'Loaded from saved project',
          result: p.result,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to load project',
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  // Export transcript
  const exportAs = useCallback(
    async (format: ExportFormat): Promise<{ success: boolean; filePath?: string }> => {
      if (!state.result || !selectedFile) return { success: false };

      try {
        let content: string;
        let extension: string;
        let filterName: string;

        switch (format) {
          case 'srt':
            content = exportTranscript.toSRT(state.result.segments);
            extension = 'srt';
            filterName = 'SRT Subtitle';
            break;
          case 'vtt':
            content = exportTranscript.toVTT(state.result.segments);
            extension = 'vtt';
            filterName = 'WebVTT Subtitle';
            break;
          case 'json':
            content = exportTranscript.toJSON(state.result);
            extension = 'json';
            filterName = 'JSON';
            break;
          case 'txt':
            content = exportTranscript.toPlainText(state.result.segments);
            extension = 'txt';
            filterName = 'Plain Text';
            break;
        }

        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const defaultName = `${baseName}.${extension}`;

        const result = await window.api.dialogSave({
          defaultName,
          filters: [{ name: filterName, extensions: [extension] }],
          content,
        });

        return { success: result.success, filePath: result.filePath };
      } catch {
        return { success: false };
      }
    },
    [state.result, selectedFile]
  );

  // Copy to clipboard
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!state.result) return false;
    try {
      await navigator.clipboard.writeText(state.result.text);
      return true;
    } catch {
      return false;
    }
  }, [state.result]);

  // Reset to idle (keep file selected for re-transcribe)
  const resetToIdle = useCallback(() => {
    setState(initialState);
  }, []);

  // Full reset (clear everything for new transcription)
  const resetFull = useCallback(() => {
    setSelectedFile(null);
    setCurrentProjectId(null);
    setState(initialState);
  }, []);

  // Computed values
  const downloadedModels = models.filter((m) => m.downloaded);
  const isIdleForRun =
    state.phase === 'idle' || state.phase === 'error' || state.phase === 'complete';
  const canTranscribe =
    selectedFile !== null &&
    isIdleForRun &&
    (engine === 'whisper'
      ? whisperReady && downloadedModels.length > 0
      : cloudKeyPresent);
  const isProcessing =
    state.phase === 'extracting' ||
    state.phase === 'uploading' ||
    state.phase === 'transcribing' ||
    state.phase === 'parsing';
  const hasResult = state.result !== null;

  return {
    // State
    state,
    selectedFile,
    engine,
    selectedModel,
    cloudModelId,
    cloudEntry,
    cloudEntries: CLOUD_ENTRIES,
    detectSpeakers,
    supportsSpeakers,
    selectedLanguage,
    models,
    downloadedModels,
    whisperReady,
    cloudKeyPresent,
    currentProjectId,

    // Actions
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
    refreshKeys,

    // Computed
    canTranscribe,
    isProcessing,
    hasResult,
  };
}
