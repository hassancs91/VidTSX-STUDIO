/**
 * Pure classifier for Python worker failures, in the classifySdCliFailure mould: the
 * protocol error line (when the worker got that far), the exit code and the spawn error
 * map to one `PythonFailureCode` with a short human message; the raw stderr tail travels
 * separately for the expandable Details. Electron-free, table-tested.
 */
import type { PythonErrorEvent, PythonFailure, PythonFailureCode, PythonFailureInput } from './types';

/** 0xC0000106 STATUS_NAME_TOO_LONG — the loader could not resolve python311.dll next to the exe. */
export const EXIT_NAME_TOO_LONG = 3221225734;
const EXIT_NAME_TOO_LONG_SIGNED = -1073741562;

/** DLL-load NTSTATUS values Node reports as exit codes (unsigned or signed). */
const DLL_EXIT_CODES = new Set([
  0xc0000135, -1073741515, // STATUS_DLL_NOT_FOUND
  0xc0000139, -1073741511, // STATUS_ENTRYPOINT_NOT_FOUND
  0xc0000142, -1073741502, // STATUS_DLL_INIT_FAILED
]);

const REPAIR_HINT = 'Use Repair on the AI Runtime row of the AI page (System tab).';

function fromProtocol(err: PythonErrorEvent): PythonFailure {
  // The runner's messages already read well (Stage 0 error matrix); keep them and add the fix.
  switch (err.code) {
    case 'oom':
      return { code: 'oom', message: err.message, hint: 'Try a lower quality setting, close other GPU apps, or switch to the CPU runtime.' };
    case 'cuda-mismatch':
      return { code: 'cuda-mismatch', message: err.message, hint: 'Update the NVIDIA driver, or install the CPU runtime from the AI page.' };
    case 'import':
      return { code: 'import', message: err.message, hint: REPAIR_HINT };
    case 'weights-corrupt':
      return { code: 'weights-corrupt', message: err.message, hint: 'Remove the model on the AI page and download it again.' };
    case 'cancelled':
      return { code: 'cancelled', message: 'Cancelled.' };
    case 'bad-request':
      return { code: 'bad-request', message: err.message };
    case 'network':
      return { code: 'network', message: err.message, hint: 'Please report this — every file a model needs should be downloaded up front.' };
    default:
      return { code: 'unknown', message: err.message, hint: 'See Details for the worker log.' };
  }
}

/**
 * Classify a failed run. Precedence: cancel → protocol error line → spawn error →
 * timeout → exit-code signatures → no result.
 */
export function classifyPythonFailure(input: PythonFailureInput): PythonFailure {
  if (input.cancelled) {
    return { code: 'cancelled', message: 'Cancelled.' };
  }
  if (input.protocolError) {
    return fromProtocol(input.protocolError);
  }
  if (input.spawnError) {
    return {
      code: 'spawn',
      message: `The AI runtime could not be started (${input.spawnError}).`,
      hint: REPAIR_HINT,
    };
  }
  if (input.timedOut) {
    return {
      code: 'timeout',
      message: 'The AI runtime stopped responding and was closed.',
      hint: 'Try again; if it keeps happening, see Details for the worker log.',
    };
  }
  const code = input.exitCode;
  if (code === EXIT_NAME_TOO_LONG || code === EXIT_NAME_TOO_LONG_SIGNED) {
    return {
      code: 'path-too-long',
      message: 'The AI runtime folder path is too long for Windows (STATUS_NAME_TOO_LONG).',
      hint: 'Enable long paths (LongPathsEnabled = 1) or use a shorter Windows user name, then reinstall the runtime.',
    };
  }
  if (code !== null && DLL_EXIT_CODES.has(code)) {
    return {
      code: 'import',
      message: 'The AI runtime is incomplete or damaged (a DLL failed to load).',
      hint: REPAIR_HINT,
    };
  }
  if (input.noResult) {
    return {
      code: 'no-result',
      message: 'The worker finished without producing a result.',
      hint: 'See Details for the worker log.',
    };
  }
  if (code === null) {
    // Killed by something other than our cancel (taskkill from outside, crash under a signal).
    return { code: 'exit', message: 'The worker was terminated before it finished.', hint: 'See Details for the worker log.' };
  }
  return {
    code: 'exit',
    message: `The worker exited with code ${code}.`,
    hint: 'See Details for the worker log.',
  };
}

/** Typed error thrown by the runner: classified code + message, raw tail as `details`. */
export class PythonRunError extends Error {
  readonly code: PythonFailureCode;
  /** Raw stderr tail for the expandable Details. */
  readonly details: string;
  readonly hint?: string;

  constructor(failure: PythonFailure, details: string) {
    super(failure.hint ? `${failure.message} ${failure.hint}` : failure.message);
    this.name = 'PythonRunError';
    this.code = failure.code;
    this.details = details;
    if (failure.hint) this.hint = failure.hint;
  }

  get isCancelled(): boolean {
    return this.code === 'cancelled';
  }
}
