import { useState, useEffect, useRef, useCallback } from 'react';
import type { SystemMonitorDataEvent } from '../../shared/ipc/types';

const HISTORY_SIZE = 60;

export interface MonitorSnapshot {
  current: SystemMonitorDataEvent | null;
  cpuHistory: number[];
  ramHistory: number[];
  appRamHistory: number[];
  gpuHistory: number[];
}

const EMPTY: MonitorSnapshot = {
  current: null,
  cpuHistory: [],
  ramHistory: [],
  appRamHistory: [],
  gpuHistory: [],
};

export function useSystemMonitor() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>(EMPTY);
  const unsubRef = useRef<(() => void) | null>(null);

  const cpuBuf = useRef<number[]>([]);
  const ramBuf = useRef<number[]>([]);
  const appRamBuf = useRef<number[]>([]);
  const gpuBuf = useRef<number[]>([]);

  const push = useCallback((arr: number[], val: number) => {
    arr.push(val);
    if (arr.length > HISTORY_SIZE) arr.shift();
  }, []);

  useEffect(() => {
    unsubRef.current = window.api.onSystemMonitorData((data: SystemMonitorDataEvent) => {
      const ramPercent = data.ramTotalBytes > 0
        ? Math.round((data.ramUsedBytes / data.ramTotalBytes) * 100)
        : 0;
      const appRamMB = Math.round(data.appRamBytes / 1024 / 1024);

      push(cpuBuf.current, data.cpuPercent);
      push(ramBuf.current, ramPercent);
      push(appRamBuf.current, appRamMB);

      if (data.gpu.available && data.gpu.usagePercent !== undefined) {
        push(gpuBuf.current, data.gpu.usagePercent);
      }

      setSnapshot({
        current: data,
        cpuHistory: [...cpuBuf.current],
        ramHistory: [...ramBuf.current],
        appRamHistory: [...appRamBuf.current],
        gpuHistory: [...gpuBuf.current],
      });
    });

    return () => {
      unsubRef.current?.();
    };
  }, [push]);

  return snapshot;
}
