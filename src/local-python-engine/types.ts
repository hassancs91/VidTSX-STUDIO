/**
 * Types shared between the Python worker client and the pipelines it runs
 * (resources/pipelines/common/protocol.py is the normative protocol). Electron-free.
 *
 * A pipeline is `python.exe <pipelines>/<id>/runner.py --request <tmp.json>`; the worker
 * answers with JSON lines on stdout and a raw log on stderr. Nothing here knows which
 * model runs — that is the catalogue's job (src/main/services/python-models/registry.ts).
 */

/** Runner folders under resources/pipelines. */
export type PythonPipelineId = 'rembg' | 'triposr';

// ─── Protocol events (one JSON object per stdout line) ──────────────────

export interface PythonReadyEvent {
  type: 'ready';
  /** null for pipelines that never import torch (rembg). */
  torch: string | null;
  cuda: boolean;
  device: string;
  vramMb: number;
  python?: string;
  importSeconds?: number;
  onnxruntime?: string;
  providers?: string[];
}

export interface PythonStageEvent {
  type: 'stage';
  name: string;
}

export interface PythonProgressEvent {
  type: 'progress';
  stage: string;
  pct: number;
}

export interface PythonResultEvent {
  type: 'result';
  outputPath: string | null;
  stats: Record<string, unknown>;
}

/** Error codes the runners emit (protocol.py ERROR_CODES). */
export type PythonProtocolErrorCode =
  | 'oom'
  | 'cuda-mismatch'
  | 'import'
  | 'weights-corrupt'
  | 'cancelled'
  | 'bad-request'
  | 'network'
  | 'unknown';

export interface PythonErrorEvent {
  type: 'error';
  code: PythonProtocolErrorCode;
  message: string;
}

export type PythonProtocolEvent =
  | PythonReadyEvent
  | PythonStageEvent
  | PythonProgressEvent
  | PythonResultEvent
  | PythonErrorEvent;

// ─── Runner ─────────────────────────────────────────────────────────────

export interface PythonRunOptions {
  /** python.exe of the installed runtime (or `process.execPath` with the mock runner in tests). */
  python: string;
  /** Absolute path of `runner.py` (or `mock-runner.mjs`). */
  runnerPath: string;
  /** Request object; written to a temp JSON file and passed as `--request`. */
  request: Record<string, unknown>;
  /** Folder for the temp request file (created if missing). */
  requestDir: string;
  /** Hide the GPU from the worker: CUDA_VISIBLE_DEVICES=-1 (never the empty string — Win32 drops it). */
  forceCpu?: boolean;
  /** Extra environment on top of the offline defaults. */
  env?: Record<string, string>;
  /** Every parsed protocol event, in order. */
  onEvent?: (event: PythonProtocolEvent) => void;
  /** Cancel: the worker tree is killed and the run rejects with code 'cancelled'. */
  signal?: AbortSignal;
  /** Kill the worker when it produces no event for this long (default 15 min; first launch under Defender is slow). */
  idleTimeoutMs?: number;
}

export interface PythonRunResult {
  outputPath: string | null;
  stats: Record<string, unknown>;
  ready: PythonReadyEvent | null;
  /** Wall time from spawn to exit. */
  ms: number;
  /** Last ~8 KB of stderr, for the expandable Details. */
  stderrTail: string;
  exitCode: number | null;
}

// ─── Failure classification ─────────────────────────────────────────────

export type PythonFailureCode =
  | PythonProtocolErrorCode
  | 'path-too-long'
  | 'spawn'
  | 'timeout'
  | 'no-result'
  | 'exit';

export interface PythonFailure {
  code: PythonFailureCode;
  /** Short, human, actionable. */
  message: string;
  /** Optional second sentence with the fix. */
  hint?: string;
}

/** What the runner saw when the worker did not deliver a result. */
export interface PythonFailureInput {
  /** The protocol error line, when the worker emitted one. */
  protocolError?: PythonErrorEvent | null;
  /** Process exit code (null when killed by a signal / taskkill). */
  exitCode: number | null;
  /** Node `spawn` error message (binary missing, EACCES…). */
  spawnError?: string | null;
  /** True when the run was cancelled through the AbortSignal. */
  cancelled?: boolean;
  /** True when the idle timeout fired. */
  timedOut?: boolean;
  /** True when the worker exited 0 without a result line. */
  noResult?: boolean;
  stderrTail?: string;
}

// ─── Engine (serial queue) ──────────────────────────────────────────────

export type PythonJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Stage-level progress as the UI sees it (mapped from protocol events). */
export interface PythonJobProgress {
  requestId: string;
  /** Protocol stage name ('import', 'load-model', 'process', 'shape', …) or 'starting' before the first event. */
  stage: string;
  /** 0–100 inside the stage when the worker reports it. */
  pct?: number;
  message?: string;
}

export interface PythonJob {
  requestId: string;
  options: PythonRunOptions;
  status: PythonJobStatus;
  settle: {
    resolve: (result: PythonRunResult) => void;
    reject: (error: Error) => void;
  };
}
