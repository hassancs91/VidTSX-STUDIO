import os from 'os';
import { execFile } from 'child_process';
import type { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc/channels';

export interface SystemMonitorData {
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  appRamBytes: number;
  gpu: {
    available: boolean;
    name?: string;
    usagePercent?: number;
    vramUsedMB?: number;
    vramTotalMB?: number;
  };
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let prevCpuTimes: { idle: number; total: number } | null = null;
let gpuAvailable: boolean | null = null;
let gpuName: string | undefined;
let monitoredWin: BrowserWindow | null = null;
let isPaused = false;
let tickCount = 0;
let lastGpu: SystemMonitorData['gpu'] = { available: false };

const handleHide = () => {
  isPaused = true;
};

const handleShow = () => {
  if (isPaused) {
    prevCpuTimes = getCpuTimes();
    isPaused = false;
  }
};

function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

function getCpuPercent(): number {
  const current = getCpuTimes();
  if (!prevCpuTimes) {
    prevCpuTimes = current;
    return 0;
  }
  const idleDiff = current.idle - prevCpuTimes.idle;
  const totalDiff = current.total - prevCpuTimes.total;
  prevCpuTimes = current;
  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

function queryGpu(): Promise<{ usagePercent: number; vramUsedMB: number; vramTotalMB: number; name: string } | null> {
  return new Promise((resolve) => {
    const bin = process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi';
    execFile(bin, [
      '--query-gpu=utilization.gpu,memory.used,memory.total,name',
      '--format=csv,noheader,nounits',
    ], { timeout: 3000, windowsHide: true }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const line = stdout.trim().split('\n')[0];
      if (!line) { resolve(null); return; }
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 4) { resolve(null); return; }
      resolve({
        usagePercent: parseInt(parts[0], 10) || 0,
        vramUsedMB: parseInt(parts[1], 10) || 0,
        vramTotalMB: parseInt(parts[2], 10) || 0,
        name: parts[3],
      });
    });
  });
}

async function collectMetrics(): Promise<SystemMonitorData> {
  tickCount += 1;

  const cpuPercent = getCpuPercent();
  const ramTotal = os.totalmem();
  const ramFree = os.freemem();
  const appRam = process.memoryUsage().rss;

  let gpu: SystemMonitorData['gpu'] = { available: false };

  if (gpuAvailable === null) {
    const result = await queryGpu();
    gpuAvailable = result !== null;
    if (result) {
      gpuName = result.name;
      gpu = { available: true, name: result.name, usagePercent: result.usagePercent, vramUsedMB: result.vramUsedMB, vramTotalMB: result.vramTotalMB };
      lastGpu = gpu;
    }
  } else if (gpuAvailable) {
    // Throttle nvidia-smi to every other tick (every 4s) — reuse cached value between polls.
    if (tickCount % 2 === 0) {
      const result = await queryGpu();
      if (result) {
        gpu = { available: true, name: gpuName ?? result.name, usagePercent: result.usagePercent, vramUsedMB: result.vramUsedMB, vramTotalMB: result.vramTotalMB };
      } else {
        gpu = { available: true, name: gpuName };
      }
      lastGpu = gpu;
    } else {
      gpu = lastGpu;
    }
  }

  return { cpuPercent, ramUsedBytes: ramTotal - ramFree, ramTotalBytes: ramTotal, appRamBytes: appRam, gpu };
}

/**
 * Start the system monitor. Called once from main/index.ts after window creation.
 * Sends SYSTEM_MONITOR_DATA push events every 2 seconds.
 */
export function initSystemMonitor(win: BrowserWindow): void {
  if (intervalId) return;

  prevCpuTimes = getCpuTimes();
  monitoredWin = win;
  isPaused = win.isMinimized() || !win.isVisible();

  win.on('hide', handleHide);
  win.on('minimize', handleHide);
  win.on('show', handleShow);
  win.on('restore', handleShow);
  win.on('focus', handleShow);

  intervalId = setInterval(async () => {
    if (win.isDestroyed()) { stopSystemMonitor(); return; }
    if (isPaused) return;
    try {
      const data = await collectMetrics();
      win.webContents.send(IPC.SYSTEM_MONITOR_DATA, data);
    } catch {
      // ignore
    }
  }, 2000);
}

export function stopSystemMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (monitoredWin && !monitoredWin.isDestroyed()) {
    monitoredWin.off('hide', handleHide);
    monitoredWin.off('minimize', handleHide);
    monitoredWin.off('show', handleShow);
    monitoredWin.off('restore', handleShow);
    monitoredWin.off('focus', handleShow);
  }
  monitoredWin = null;
  isPaused = false;
  tickCount = 0;
  lastGpu = { available: false };
  prevCpuTimes = null;
}
