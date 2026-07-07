import { useEffect, useState } from 'react';

export interface WhisperAvailability {
  // Binary present AND at least one model downloaded — i.e. local
  // transcription could actually run.
  ready: boolean;
  // Binary installed (regardless of models).
  binaryInstalled: boolean;
  // Count of downloaded models.
  downloadedModels: number;
  // Ids of downloaded models (e.g. 'base', 'small') for model pickers.
  downloadedModelIds: string[];
  loading: boolean;
}

const INITIAL: WhisperAvailability = {
  ready: false,
  binaryInstalled: false,
  downloadedModels: 0,
  downloadedModelIds: [],
  loading: true,
};

// Detects whether local Whisper is usable on this machine. Read-only — drives
// the "Local — Whisper" transcription-source option in the Analyze tab.
export function useWhisperAvailability(): WhisperAvailability {
  const [state, setState] = useState<WhisperAvailability>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [binary, models] = await Promise.all([
          window.api.whisperBinaryStatus(),
          window.api.whisperModelsList(),
        ]);
        if (cancelled) return;
        const downloaded = (models.models ?? []).filter((m) => m.downloaded);
        setState({
          ready: binary.installed && downloaded.length > 0,
          binaryInstalled: binary.installed,
          downloadedModels: downloaded.length,
          downloadedModelIds: downloaded.map((m) => m.id),
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setState({ ...INITIAL, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
