import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  UpdateChannel,
  UpdaterInstallResponse,
  UpdaterState,
} from '@shared/ipc/types';
import { createRendererLogger } from '../utils/logger';

const log = createRendererLogger('Updater');

/**
 * A check that resolves instantly reads as a broken button, so hold the spinner
 * for at least this long before showing the answer.
 */
const MIN_CHECK_SPINNER_MS = 600;

export interface UseUpdaterResult {
  state: UpdaterState | null;
  /** True while a check is in flight, including the minimum spinner hold. */
  checking: boolean;
  /** A restart right now would interrupt work — see the main-process update gate. */
  blocked: boolean;
  check: () => Promise<void>;
  download: () => Promise<void>;
  cancel: () => Promise<void>;
  install: () => Promise<UpdaterInstallResponse | null>;
  setAutoDownload: (enabled: boolean) => Promise<void>;
  setChannel: (channel: UpdateChannel) => Promise<void>;
  skipVersion: (version: string | null) => Promise<void>;
}

export function useUpdater(): UseUpdaterResult {
  const [state, setState] = useState<UpdaterState | null>(null);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    window.api
      .updaterGetState()
      .then((response) => {
        if (mounted.current) setState(response.state);
      })
      .catch((error) => log.error('Failed to read updater state', error));

    const unsubscribe = window.api.onUpdaterState((event) => {
      if (mounted.current) setState(event.state);
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    const startedAt = Date.now();
    try {
      const response = await window.api.updaterCheck({ trigger: 'manual' });
      if (mounted.current) setState(response.state);
    } catch (error) {
      log.error('Update check failed', error);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_CHECK_SPINNER_MS - elapsed);
      setTimeout(() => {
        if (mounted.current) setChecking(false);
      }, remaining);
    }
  }, []);

  const download = useCallback(async () => {
    try {
      await window.api.updaterDownload();
    } catch (error) {
      log.error('Update download failed', error);
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      await window.api.updaterCancel();
    } catch (error) {
      log.error('Cancel failed', error);
    }
  }, []);

  const install = useCallback(async (): Promise<UpdaterInstallResponse | null> => {
    try {
      return await window.api.updaterInstall();
    } catch (error) {
      log.error('Install failed', error);
      return null;
    }
  }, []);

  const applyPrefs = useCallback(
    async (prefs: { autoDownload?: boolean; channel?: UpdateChannel; skipVersion?: string | null }) => {
      try {
        const response = await window.api.updaterSetPrefs(prefs);
        if (mounted.current) setState(response.state);
      } catch (error) {
        log.error('Failed to save update preferences', error);
      }
    },
    []
  );

  const setAutoDownload = useCallback(
    (enabled: boolean) => applyPrefs({ autoDownload: enabled }),
    [applyPrefs]
  );
  const setChannel = useCallback(
    (channel: UpdateChannel) => applyPrefs({ channel }),
    [applyPrefs]
  );
  const skipVersion = useCallback(
    (version: string | null) => applyPrefs({ skipVersion: version }),
    [applyPrefs]
  );

  return {
    state,
    checking: checking || state?.status === 'checking',
    blocked: (state?.blockers.length ?? 0) > 0,
    check,
    download,
    cancel,
    install,
    setAutoDownload,
    setChannel,
    skipVersion,
  };
}
