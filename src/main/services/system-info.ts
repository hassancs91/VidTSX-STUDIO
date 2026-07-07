import os from 'os';
import path from 'path';
import { statfsSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { app } from 'electron';
import { getPythonExePath, getPythonPackagesDir } from '../utils/paths';
import { getAiModelsFolder } from './settings';
import { audioEngine } from '../../audio-engine';
import { llmLocalEngine } from '../../llm-engine';
import { isSdCliInstalled } from './sdimage-models';
import type { SystemInfoGetResponse } from '../../shared/ipc/types';

// ─── GPU / CUDA detection via nvidia-smi ──────────────────────────

interface GpuResult {
  name: string;
  vramTotalMB: number;
  cudaVersion: string | null;
}

function detectGpu(): Promise<GpuResult | null> {
  return new Promise((resolve) => {
    const bin = process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi';

    // First query: get GPU name + vram
    execFile(bin, [
      '--query-gpu=name,memory.total',
      '--format=csv,noheader,nounits',
    ], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) { resolve(null); return; }

      const line = stdout.trim().split('\n')[0];
      if (!line) { resolve(null); return; }

      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 2) { resolve(null); return; }

      const name = parts[0];
      const vramTotalMB = parseInt(parts[1], 10) || 0;

      // Second query: parse CUDA version from nvidia-smi header
      execFile(bin, [], { timeout: 5000, windowsHide: true }, (err2, stdout2) => {
        let cudaVersion: string | null = null;
        if (!err2 && stdout2) {
          const match = stdout2.match(/CUDA Version:\s*([\d.]+)/);
          if (match) {
            cudaVersion = match[1];
          }
        }
        resolve({ name, vramTotalMB, cudaVersion });
      });
    });
  });
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

// ─── Python detection ─────────────────────────────────────────────

function detectPython(): Promise<{ available: boolean; version: string | null; path: string | null }> {
  const pythonPath = getPythonExePath();

  if (!existsSync(pythonPath)) {
    return Promise.resolve({ available: false, version: null, path: null });
  }

  return new Promise((resolve) => {
    execFile(pythonPath, ['--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve({ available: true, version: null, path: pythonPath });
        return;
      }
      // Output: "Python 3.13.x"
      const match = stdout.trim().match(/Python\s+([\d.]+)/);
      resolve({
        available: true,
        version: match ? match[1] : null,
        path: pythonPath,
      });
    });
  });
}

// ─── PyTorch detection ────────────────────────────────────────────

function detectCachedWheels(aiModelsFolder: string): ('cpu' | 'gpu')[] {
  const cached: ('cpu' | 'gpu')[] = [];
  if (existsSync(path.join(aiModelsFolder, 'torch-2.11.0+cpu-cp313-cp313-win_amd64.whl'))) cached.push('cpu');
  if (existsSync(path.join(aiModelsFolder, 'torch-2.11.0+cu126-cp313-cp313-win_amd64.whl'))) cached.push('gpu');
  return cached;
}

function detectPyTorch(): Promise<{ installed: boolean; version?: string; variant?: 'cpu' | 'gpu' }> {
  const packagesDir = getPythonPackagesDir();
  const torchDir = `${packagesDir}/torch`;

  if (!existsSync(torchDir)) {
    return Promise.resolve({ installed: false });
  }

  const pythonPath = getPythonExePath();
  if (!existsSync(pythonPath)) {
    return Promise.resolve({ installed: true });
  }

  return new Promise((resolve) => {
    // The embedded Python's ._pth file overrides PYTHONPATH, so we inject
    // the packages dir via sys.path.insert directly in the script.
    const script = [
      `import sys; sys.path.insert(0, r'${packagesDir.replace(/\\/g, '\\\\')}')`,
      'import torch; print(torch.__version__); print(torch.cuda.is_available())',
    ].join('; ');

    execFile(pythonPath, ['-c', script], {
      timeout: 10000,
      windowsHide: true,
    }, (err, stdout) => {
      if (err) {
        resolve({ installed: true });
        return;
      }
      const lines = stdout.trim().split('\n');
      const version = lines[0]?.trim();
      const cudaAvailable = lines[1]?.trim().toLowerCase() === 'true';
      resolve({
        installed: true,
        version,
        variant: cudaAvailable ? 'gpu' : 'cpu',
      });
    });
  });
}

// ─── Main entry point ─────────────────────────────────────────────

export async function getSystemInfo(): Promise<SystemInfoGetResponse> {
  const [gpuResult, pythonResult, pytorchResult, llmAvailable, aiModelsFolder] = await Promise.all([
    detectGpu(),
    detectPython(),
    detectPyTorch(),
    llmLocalEngine.isAvailable(),
    getAiModelsFolder(),
  ]);

  const ramTotal = os.totalmem();
  const ramFree = os.freemem();
  const disk = getDiskInfo();

  const audioAvailable = audioEngine.isSherpaAvailable();
  const imageAvailable = isSdCliInstalled();
  const cachedWheels = detectCachedWheels(aiModelsFolder);

  return {
    gpu: {
      name: gpuResult?.name ?? null,
      cudaVersion: gpuResult?.cudaVersion ?? null,
      vramTotalMB: gpuResult?.vramTotalMB ?? null,
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
      pytorch: { ...pytorchResult, cachedWheels },
    },
    python: pythonResult,
  };
}
