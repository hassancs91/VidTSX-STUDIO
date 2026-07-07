import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AudioModelIpc,
  AudioSttPartialEvent,
} from '../../../shared/ipc/types';

interface TtsState {
  generating: boolean;
  audioBase64: string | null;
  sampleRate: number | null;
  durationSeconds: number | null;
  error: string | null;
  elapsedMs: number | null;
}

interface SttState {
  transcribing: boolean;
  streaming: boolean;
  result: string | null;
  partialText: string;
  error: string | null;
  elapsedMs: number | null;
}

export function useVoiceAITester() {
  const [models, setModels] = useState<AudioModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  const [selectedTtsModelId, setSelectedTtsModelId] = useState<string | null>(null);
  const [selectedSttModelId, setSelectedSttModelId] = useState<string | null>(null);

  const [tts, setTts] = useState<TtsState>({
    generating: false,
    audioBase64: null,
    sampleRate: null,
    durationSeconds: null,
    error: null,
    elapsedMs: null,
  });

  const [stt, setStt] = useState<SttState>({
    transcribing: false,
    streaming: false,
    result: null,
    partialText: '',
    error: null,
    elapsedMs: null,
  });

  const sttCleanupRef = useRef<(() => void) | null>(null);

  // Load models on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [status, list] = await Promise.all([
          window.api.audioStatus(),
          window.api.audioModelsList(),
        ]);
        setAvailable(status.available);
        const downloaded = list.models.filter((m) => m.downloaded);
        setModels(downloaded);

        // Auto-select first downloaded model of each type
        const firstTts = downloaded.find((m) => m.type === 'tts');
        const firstStt = downloaded.find((m) => m.type === 'stt');
        if (firstTts) setSelectedTtsModelId(firstTts.id);
        if (firstStt) setSelectedSttModelId(firstStt.id);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── TTS ────────────────────────────────────────────────────────────

  const generateSpeech = useCallback(async (text: string, speakerId?: number, speed?: number) => {
    if (!selectedTtsModelId || tts.generating) return;

    setTts({ generating: true, audioBase64: null, sampleRate: null, durationSeconds: null, error: null, elapsedMs: null });

    try {
      // Load model first
      const loadResult = await window.api.audioTtsLoadModel({ modelId: selectedTtsModelId });
      if (!loadResult.success) {
        setTts((prev) => ({ ...prev, generating: false, error: loadResult.error || 'Failed to load model' }));
        return;
      }

      const start = Date.now();
      const result = await window.api.audioTtsGenerate({ text, speakerId, speed });
      const elapsed = Date.now() - start;

      if (result.success) {
        setTts({
          generating: false,
          audioBase64: result.audioBase64 ?? null,
          sampleRate: result.sampleRate ?? null,
          durationSeconds: result.durationSeconds ?? null,
          error: null,
          elapsedMs: elapsed,
        });
      } else {
        setTts((prev) => ({ ...prev, generating: false, error: result.error || 'Generation failed' }));
      }
    } catch (err) {
      setTts((prev) => ({
        ...prev,
        generating: false,
        error: err instanceof Error ? err.message : 'Generation failed',
      }));
    }
  }, [selectedTtsModelId, tts.generating]);

  // ─── STT: File transcription ────────────────────────────────────────

  const transcribeFile = useCallback(async () => {
    if (!selectedSttModelId || stt.transcribing) return;

    // Pick audio file
    const dialogResult = await window.api.dialogOpen({
      filters: [{ name: 'Audio/Video', extensions: ['wav', 'mp3', 'flac', 'ogg', 'mp4', 'mkv', 'webm', 'm4a'] }],
    });
    if (dialogResult.canceled || !dialogResult.filePaths.length) return;
    const filePath = dialogResult.filePaths[0];

    setStt({ transcribing: true, streaming: false, result: null, partialText: '', error: null, elapsedMs: null });

    try {
      // Load model first
      const loadResult = await window.api.audioSttLoadModel({ modelId: selectedSttModelId });
      if (!loadResult.success) {
        setStt((prev) => ({ ...prev, transcribing: false, error: loadResult.error || 'Failed to load model' }));
        return;
      }

      const start = Date.now();
      const result = await window.api.audioSttTranscribe({ inputPath: filePath });
      const elapsed = Date.now() - start;

      if (result.success && result.result) {
        setStt({
          transcribing: false,
          streaming: false,
          result: result.result.text,
          partialText: '',
          error: null,
          elapsedMs: elapsed,
        });
      } else {
        setStt((prev) => ({ ...prev, transcribing: false, error: result.error || 'Transcription failed' }));
      }
    } catch (err) {
      setStt((prev) => ({
        ...prev,
        transcribing: false,
        error: err instanceof Error ? err.message : 'Transcription failed',
      }));
    }
  }, [selectedSttModelId, stt.transcribing]);

  // ─── STT: Streaming (live mic) ─────────────────────────────────────

  const startStreaming = useCallback(async () => {
    if (!selectedSttModelId || stt.streaming) return;

    const model = models.find((m) => m.id === selectedSttModelId);
    if (!model || model.sttMode !== 'online') {
      setStt((prev) => ({ ...prev, error: 'Selected model does not support streaming. Choose a streaming (online) model.' }));
      return;
    }

    setStt({ transcribing: false, streaming: true, result: null, partialText: '', error: null, elapsedMs: null });

    try {
      const loadResult = await window.api.audioSttLoadModel({ modelId: selectedSttModelId });
      if (!loadResult.success) {
        setStt((prev) => ({ ...prev, streaming: false, error: loadResult.error || 'Failed to load model' }));
        return;
      }

      // Subscribe to partial results
      sttCleanupRef.current = window.api.onAudioSttPartial((event: AudioSttPartialEvent) => {
        setStt((prev) => ({ ...prev, partialText: event.text }));
      });

      const startResult = await window.api.audioSttStreamStart();
      if (!startResult.success) {
        sttCleanupRef.current?.();
        setStt((prev) => ({ ...prev, streaming: false, error: startResult.error || 'Failed to start streaming' }));
      }
    } catch (err) {
      sttCleanupRef.current?.();
      setStt((prev) => ({
        ...prev,
        streaming: false,
        error: err instanceof Error ? err.message : 'Streaming failed',
      }));
    }
  }, [selectedSttModelId, stt.streaming, models]);

  const stopStreaming = useCallback(async () => {
    try {
      const result = await window.api.audioSttStreamStop();
      sttCleanupRef.current?.();
      sttCleanupRef.current = null;

      if (result.success && result.result) {
        setStt((prev) => ({
          ...prev,
          streaming: false,
          result: result.result!.text,
          partialText: '',
        }));
      } else {
        setStt((prev) => ({
          ...prev,
          streaming: false,
          error: result.error || 'Failed to stop streaming',
        }));
      }
    } catch (err) {
      setStt((prev) => ({
        ...prev,
        streaming: false,
        error: err instanceof Error ? err.message : 'Stop failed',
      }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sttCleanupRef.current?.();
    };
  }, []);

  const ttsModels = models.filter((m) => m.type === 'tts');
  const sttModels = models.filter((m) => m.type === 'stt');

  return {
    available,
    loading,
    ttsModels,
    sttModels,
    selectedTtsModelId,
    selectedSttModelId,
    setSelectedTtsModelId,
    setSelectedSttModelId,
    tts,
    stt,
    generateSpeech,
    transcribeFile,
    startStreaming,
    stopStreaming,
  };
}
