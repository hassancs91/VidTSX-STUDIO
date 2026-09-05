import { useEffect, useState } from 'react';
import type { AiRuntimeStatus, AiRuntimeVariant } from '../../../shared/ipc/types';

export interface ThreeDRuntimeInfo {
  state: AiRuntimeStatus['state'] | 'unknown';
  variant: AiRuntimeVariant | null;
  vramGB: number | null;
  gpuName: string | null;
}

/** Runtime facts the control panel needs: variant (GPU/CPU), VRAM for the quality cap. */
export function useThreeDRuntime(): ThreeDRuntimeInfo {
  const [info, setInfo] = useState<ThreeDRuntimeInfo>({ state: 'unknown', variant: null, vramGB: null, gpuName: null });

  useEffect(() => {
    let alive = true;
    const apply = (s: AiRuntimeStatus) => {
      if (!alive) return;
      setInfo({
        state: s.state,
        variant: s.installed?.variant ?? null,
        vramGB: s.gpu.vramTotalMB ? s.gpu.vramTotalMB / 1024 : null,
        gpuName: s.gpu.name,
      });
    };
    void window.api.aiRuntimeStatus().then((res) => {
      if (res.success && res.status) apply(res.status);
    });
    const unsub = window.api.onAiRuntimeStatusChanged(apply);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return info;
}
