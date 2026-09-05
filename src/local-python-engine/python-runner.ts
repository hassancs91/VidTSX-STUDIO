/**
 * Spawn one pipeline run and turn its JSON lines into a typed result (plan §4 step 1).
 *
 *   write request → temp JSON  →  spawn python.exe runner.py --request <tmp>
 *   stdout → protocol parser (partial-chunk tolerant) → onEvent
 *   stderr → ring buffer (Details)
 *   cancel → taskkill /PID <pid> /T /F  (Stage 0: tree gone < 1.1 s, 0 orphans)
 *   exit   → result line, or a classified PythonRunError
 *
 * Environment: HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE so an undeclared companion surfaces
 * as the 'network' code instead of a silent download; PYTHONUTF8 so paths with non-ASCII
 * characters survive; CUDA_VISIBLE_DEVICES=-1 (never "") when the caller forces the CPU.
 * Node-only (no electron) so the mock runner drives it in vitest.
 */
import { spawn, execFile, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createProtocolParser } from './protocol-parser';
import { classifyPythonFailure, PythonRunError } from './python-failure';
import type { PythonErrorEvent, PythonReadyEvent, PythonRunOptions, PythonRunResult } from './types';

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STDERR_TAIL_BYTES = 8000;

let activeProcess: ChildProcess | null = null;

/** Offline-by-construction worker environment. Exported for the buildRequest test. */
export function buildWorkerEnv(base: NodeJS.ProcessEnv, forceCpu: boolean, extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
    ...extra,
  };
  if (forceCpu) {
    // Win32 treats an empty environment value as "unset" — "-1" is what hides the GPU.
    env.CUDA_VISIBLE_DEVICES = '-1';
  }
  return env;
}

/** Kill a worker and everything it spawned. Fire-and-forget; the `close` event confirms. */
export function killTree(pid: number): void {
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

export function killActive(): boolean {
  const pid = activeProcess?.pid;
  if (!pid) return false;
  killTree(pid);
  return true;
}

export function isRunning(): boolean {
  return activeProcess !== null;
}

async function writeRequestFile(dir: string, request: Record<string, unknown>): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `request-${randomUUID()}.json`);
  await fs.writeFile(file, JSON.stringify(request), 'utf8');
  return file;
}

export async function runPipeline(opts: PythonRunOptions): Promise<PythonRunResult> {
  if (opts.signal?.aborted) {
    throw new PythonRunError(classifyPythonFailure({ cancelled: true, exitCode: null }), '');
  }
  const requestFile = await writeRequestFile(opts.requestDir, opts.request);
  const env = buildWorkerEnv(process.env, Boolean(opts.forceCpu), opts.env);
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const t0 = Date.now();

  try {
    return await new Promise<PythonRunResult>((resolve, reject) => {
      let stderrTail = '';
      let ready: PythonReadyEvent | null = null;
      let result: { outputPath: string | null; stats: Record<string, unknown> } | null = null;
      let protocolError: PythonErrorEvent | null = null;
      let cancelled = false;
      let timedOut = false;
      let spawnError: string | null = null;
      let settled = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const armIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          timedOut = true;
          if (child.pid) killTree(child.pid);
        }, idleMs);
      };

      const child = spawn(opts.python, [opts.runnerPath, '--request', requestFile], {
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.dirname(opts.runnerPath),
      });
      activeProcess = child;

      const parser = createProtocolParser((evt) => {
        armIdle();
        if (evt.type === 'ready') ready = evt;
        else if (evt.type === 'result') result = { outputPath: evt.outputPath, stats: evt.stats };
        else if (evt.type === 'error') protocolError = evt;
        try {
          opts.onEvent?.(evt);
        } catch {
          /* a listener must not kill the run */
        }
      });

      const onAbort = () => {
        cancelled = true;
        if (child.pid) killTree(child.pid);
      };
      opts.signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => parser.push(chunk));
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_BYTES);
      });

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        opts.signal?.removeEventListener('abort', onAbort);
        if (activeProcess === child) activeProcess = null;
        parser.flush();

        if (result && !protocolError && !cancelled && exitCode === 0) {
          resolve({ ...result, ready, ms: Date.now() - t0, stderrTail, exitCode });
          return;
        }
        const failure = classifyPythonFailure({
          protocolError: cancelled ? null : protocolError,
          exitCode,
          spawnError,
          cancelled,
          timedOut,
          noResult: exitCode === 0 && !result,
          stderrTail,
        });
        reject(new PythonRunError(failure, stderrTail));
      };

      child.on('error', (err) => {
        spawnError = err.message;
        finish(null);
      });
      child.on('close', (code) => finish(code));
      armIdle();
    });
  } finally {
    await fs.unlink(requestFile).catch(() => {});
  }
}
