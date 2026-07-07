import { useCallback, useEffect, useRef, useState } from 'react';

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

interface UpdaterState {
  phase: UpdaterPhase;
  currentVersion: string;
  newVersion: string | null;
  releaseNotes: string | null;
  progress: number;
  bytesPerSecond: number;
  errorMessage: string | null;
}

const initialState: UpdaterState = {
  phase: 'idle',
  currentVersion: '',
  newVersion: null,
  releaseNotes: null,
  progress: 0,
  bytesPerSecond: 0,
  errorMessage: null,
};

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>(initialState);
  // In-memory only — resets on app restart, per spec.
  const dismissedVersionRef = useRef<string | null>(null);
  // Tracks an explicit user-initiated check so the UI can show "up to date" inline.
  const userCheckPendingRef = useRef(false);
  const [justUpToDate, setJustUpToDate] = useState(false);

  // Load current version on mount.
  useEffect(() => {
    let cancelled = false;
    window.api
      .updaterGetCurrentVersion()
      .then((res) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, currentVersion: res.version }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to push events.
  useEffect(() => {
    const offAvailable = window.api.onUpdaterUpdateAvailable((info) => {
      userCheckPendingRef.current = false;
      if (info.version === dismissedVersionRef.current) {
        // User already dismissed this version — keep banner hidden.
        setState((prev) => ({ ...prev, phase: 'idle' }));
        return;
      }
      setState((prev) => ({
        ...prev,
        phase: 'available',
        newVersion: info.version,
        releaseNotes: info.releaseNotes,
        errorMessage: null,
      }));
    });

    const offUpToDate = window.api.onUpdaterUpToDate(() => {
      const wasUserCheck = userCheckPendingRef.current;
      userCheckPendingRef.current = false;
      setState((prev) => ({ ...prev, phase: 'idle', errorMessage: null }));
      if (wasUserCheck) {
        setJustUpToDate(true);
        setTimeout(() => setJustUpToDate(false), 3000);
      }
    });

    const offProgress = window.api.onUpdaterDownloadProgress((p) => {
      setState((prev) => ({
        ...prev,
        phase: 'downloading',
        progress: p.percent,
        bytesPerSecond: p.bytesPerSecond,
      }));
    });

    const offDownloaded = window.api.onUpdaterUpdateDownloaded((info) => {
      setState((prev) => ({
        ...prev,
        phase: 'ready',
        newVersion: info.version,
        progress: 100,
      }));
    });

    const offError = window.api.onUpdaterError((err) => {
      userCheckPendingRef.current = false;
      setState((prev) => ({ ...prev, phase: 'error', errorMessage: err.message }));
    });

    return () => {
      offAvailable();
      offUpToDate();
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  const check = useCallback(async () => {
    userCheckPendingRef.current = true;
    setJustUpToDate(false);
    setState((prev) => ({ ...prev, phase: 'checking', errorMessage: null }));
    await window.api.updaterCheck();
  }, []);

  const download = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      phase: 'downloading',
      progress: 0,
      bytesPerSecond: 0,
    }));
    await window.api.updaterDownload();
  }, []);

  const install = useCallback(async () => {
    await window.api.updaterInstall();
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.newVersion) dismissedVersionRef.current = prev.newVersion;
      return { ...prev, phase: 'idle', errorMessage: null };
    });
  }, []);

  return {
    ...state,
    justUpToDate,
    check,
    download,
    install,
    dismiss,
  };
}
