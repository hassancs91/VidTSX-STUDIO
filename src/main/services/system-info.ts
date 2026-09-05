import os from 'os';
import { statfsSync } from 'fs';
import { execFile } from 'child_process';
import { app } from 'electron';
import { audioEngine } from '../../audio-engine';
import { llmLocalEngine } from '../../llm-engine';
import { isSdCliInstalled } from './sdimage-models';
import type { SystemInfoGetResponse } from '../../shared/ipc/types';

// ─── GPU / CUDA detection via nvidia-smi ──────────────────────────

interface GpuResult {
  name: string;
  vramTotalMB: number;
  /** Free VRAM at query time, MB. -1 when nvidia-smi didn't report it. */
  vramFreeMB: number;
  cudaVersion: string | null;
}

function detectGpu(): Promise<GpuResult | null> {
  return new Promise((resolve) => {
    const bin = process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi';

    // First query: get GPU name + total/free VRAM (NVIDIA only; graceful null otherwise).
    execFile(bin, [
      '--query-gpu=name,memory.total,memory.free',
      '--format=csv,noheader,nounits',
    ], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) { resolve(null); return; }

      const line = stdout.trim().split('\n')[0];
      if (!line) { resolve(null); return; }

      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 2) { resolve(null); return; }

      const name = parts[0];
      const vramTotalMB = parseInt(parts[1], 10) || 0;
      const vramFreeMB = parts.length >= 3 ? (parseInt(parts[2], 10) || 0) : -1;

      // Second query: parse CUDA version from nvidia-smi header
      execFile(bin, [], { timeout: 5000, windowsHide: true }, (err2, stdout2) => {
        let cudaVersion: string | null = null;
        if (!err2 && stdout2) {
          const match = stdout2.match(/CUDA Version:\s*([\d.]+)/);
          if (match) {
            cudaVersion = match[1];
          }
        }
        resolve({ name, vramTotalMB, vramFreeMB, cudaVersion });
      });
    });
  });
}

// ─── Cached hardware snapshot for the VRAM/RAM preflight ───────────────

/** Detected total VRAM / RAM in GB, for the model-fit preflight. `null` VRAM = unknown. */
export interface PreflightHardware {
  vramGB: number | null;
  ramGB: number;
}

let preflightCache: PreflightHardware | null = null;

/**
 * Total VRAM/RAM (GB) for the model-fit preflight. GPU detection is memoized for
 * the process (total VRAM is static hardware) so frequent library rescans don't
 * re-spawn nvidia-smi. Non-NVIDIA / no nvidia-smi → `vramGB: null` (unknown).
 */
export async function getPreflightHardware(): Promise<PreflightHardware> {
  if (preflightCache) return preflightCache;
  const gpu = await detectGpu();
  const vramGB = gpu && gpu.vramTotalMB > 0 ? gpu.vramTotalMB / 1024 : null;
  const ramGB = os.totalmem() / (1024 * 1024 * 1024);
  preflightCache = { vramGB, ramGB };
  return preflightCache;
}

// ─── Disk free space ──────────────────────────────────────────────

function getDiskInfo(): { freeBytes: number; totalBytes: number } {
  try {
    const userDataPath = app.getPath('userData');
    const stats = statfsSync(userDataPath);
    return {
      freeBytes: stats.bfree * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

// ─── Main entry point ─────────────────────────────────────────────

export async function getSystemInfo(): Promise<SystemInfoGetResponse> {
  const [gpuResult, llmAvailable] = await Promise.all([
    detectGpu(),
    llmLocalEngine.isAvailable(),
  ]);

  const ramTotal = os.totalmem();
  const ramFree = os.freemem();
  const disk = getDiskInfo();

  const audioAvailable = audioEngine.isSherpaAvailable();
  const imageAvailable = isSdCliInstalled();

  return {
    gpu: {
      name: gpuResult?.name ?? null,
      cudaVersion: gpuResult?.cudaVersion ?? null,
      vramTotalMB: gpuResult?.vramTotalMB ?? null,
      vramFreeMB: gpuResult && gpuResult.vramFreeMB >= 0 ? gpuResult.vramFreeMB : null,
    },
    ram: {
      totalBytes: ramTotal,
      freeBytes: ramFree,
    },
    disk,
    engines: {
      audio: { available: audioAvailable },
      llm: { available: llmAvailable, backend: llmLocalEngine.getGpuInfo()?.backend },
      embedding: { available: false },
      image: { available: imageAvailable },
    },
  };
}
