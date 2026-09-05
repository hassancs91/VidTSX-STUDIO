/**
 * Run a pipeline's `--selftest` / `--warmup` with an installed runtime and parse the
 * protocol `ready` line (resources/pipelines/common/protocol.py). Used by the install
 * "verify" step; the generic worker client for real generations comes in Stage 3.
 *
 * Bytecode writes are deliberately allowed here (unlike the build box): the warm-up
 * is what compiles the stack once so the user's first generation is not the slow one
 * (Stage 0: 170 s cold vs 34 s warm on freshly extracted files).
 */
import { spawn, execFile } from 'child_process';
import path from 'path';

export type AiRuntimePipeline = 'triposr' | 'rembg';

export interface ReadyEvent {
  type: 'ready';
  /** null for pipelines that do not import torch (rembg). */
  torch: string | null;
  cuda: boolean;
  device: string;
  vramMb: number;
  python?: string;
  importSeconds?: number;
  onnxruntime?: string;
  providers?: string[];
}

export interface SelftestResult {
  ready: ReadyEvent;
  ms: number;
  stderrTail: string;
}

export interface SelftestOptions {
  mode?: 'selftest' | 'warmup';
  timeoutMs?: number;
  /** Force the CPU path (Win32 drops empty env values, so this must be "-1"). */
  forceCpu?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // first launch of fresh files can take minutes under Defender

export class AiRuntimeSelftestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly stderrTail: string,
  ) {
    super(message);
    this.name = 'AiRuntimeSelftestError';
  }
}

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

export function runPipelineSelftest(
  pythonExe: string,
  pipelinesDir: string,
  pipeline: AiRuntimePipeline,
  opts: SelftestOptions = {},
): Promise<SelftestResult> {
  const runner = path.join(pipelinesDir, pipeline, 'runner.py');
  const flag = opts.mode === 'warmup' ? '--warmup' : '--selftest';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONUTF8: '1',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
  };
  if (opts.forceCpu) env.CUDA_VISIBLE_DEVICES = '-1';

  return new Promise<SelftestResult>((resolve, reject) => {
    const t0 = Date.now();
    const child = spawn(pythonExe, [runner, flag], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutBuf = '';
    let stderrTail = '';
    let ready: ReadyEvent | null = null;
    let protocolError: { code: string; message: string } | null = null;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (child.pid) killTree(child.pid);
      reject(new AiRuntimeSelftestError(`${pipeline} ${flag} timed out after ${Math.round((opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)} s`, 'timeout', stderrTail));
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const consume = (line: string) => {
      const t = line.trim();
      if (!t.startsWith('{')) return;
      try {
        const evt = JSON.parse(t) as { type?: string; code?: string; message?: string };
        if (evt.type === 'ready' && !ready) ready = evt as unknown as ReadyEvent;
        if (evt.type === 'error') protocolError = { code: evt.code ?? 'unknown', message: evt.message ?? 'unknown error' };
      } catch { /* not a protocol line */ }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8');
      let nl = stdoutBuf.indexOf('\n');
      while (nl >= 0) {
        consume(stdoutBuf.slice(0, nl));
        stdoutBuf = stdoutBuf.slice(nl + 1);
        nl = stdoutBuf.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4000);
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AiRuntimeSelftestError(`Could not start ${pythonExe}: ${err.message}`, 'spawn', stderrTail));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stdoutBuf.trim()) consume(stdoutBuf);
      if (protocolError) {
        reject(new AiRuntimeSelftestError(`${pipeline}: ${protocolError.message}`, protocolError.code, stderrTail));
        return;
      }
      // 0xC0000106 = STATUS_NAME_TOO_LONG: the loader could not even resolve python311.dll.
      if (code === 3221225734) {
        reject(new AiRuntimeSelftestError('The runtime path is too long for Windows (STATUS_NAME_TOO_LONG).', 'path-too-long', stderrTail));
        return;
      }
      if (code !== 0 || !ready) {
        reject(new AiRuntimeSelftestError(`${pipeline} ${flag} exited with code ${code ?? 'null'} without a ready line`, 'exit', stderrTail));
        return;
      }
      resolve({ ready, ms: Date.now() - t0, stderrTail });
    });
  });
}
