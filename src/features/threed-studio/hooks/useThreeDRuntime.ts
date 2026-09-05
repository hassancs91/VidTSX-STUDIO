import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiRuntimeStatus, AiRuntimeVariant } from '../../../shared/ipc/types';

export interface ThreeDRuntimeInfo {
  state: AiRuntimeStatus['state'] | 'unknown';
  variant: AiRuntimeVariant | null;
  vramGB: number | null;
  gpuName: string | null;
}

const UNKNOWN: ThreeDRuntimeInfo = { state: 'unknown', variant: null, vramGB: null, gpuName: null };

/**
 * Runtime facts the control panel needs: variant (GPU/CPU) and VRAM for the quality
 * cap. Pushed on every install / remove; also re-read on window focus and on demand
 * (before a Generate) so a runtime folder changed outside the app is picked up.
 */
export function useThreeDRuntime(): ThreeDRuntimeInfo & { refresh: () => Promise<void> } {
  const [info, setInfo] = useState<ThreeDRuntimeInfo>(UNKNOWN);
  const alive = useRef(true);

  const apply = useCallback((s: AiRuntimeStatus) => {
    if (!alive.current) return;
    setInfo({
      state: s.state,
      variant: s.installed?.variant ?? null,
      vramGB: s.gpu.vramTotalMB ? s.gpu.vramTotalMB / 1024 : null,
      gpuName: s.gpu.name,
    });
  }, []);

  const refresh = useCallback(async () => {
    const res = await window.api.aiRuntimeStatus().catch(() => null);
    if (res?.success && res.status) apply(res.status);
  }, [apply]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const unsub = window.api.onAiRuntimeStatusChanged(apply);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      unsub();
      window.removeEventListener('focus', onFocus);
    };
  }, [apply, refresh]);

  return { ...info, refresh };
}
