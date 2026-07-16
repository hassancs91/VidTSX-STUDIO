/**
 * Pure classifier for sd-cli (stable-diffusion.cpp) runtime failures.
 * Maps raw exit codes + stderr/stdout output to short, actionable messages
 * while the raw tail travels separately for debugging. Electron-free — unit
 * tested directly (like the model-library core).
 */

export type SdCliFailureCode =
  | 'corrupt-model'
  | 'out-of-memory'
  | 'unsupported-model'
  | 'missing-dll'
  | 'cancelled'
  | 'unknown';

export interface SdCliFailure {
  code: SdCliFailureCode;
  message: string;
  hint?: string;
}

/** Typed error thrown by the runner so the engine can forward code + raw output. */
export class SdCliError extends Error {
  readonly code: SdCliFailureCode;
  /** Raw sd-cli output tail, for the expandable "Details" in the UI. */
  readonly details: string;

  constructor(failure: SdCliFailure, details: string) {
    super(failure.hint ? `${failure.message} ${failure.hint}` : failure.message);
    this.name = 'SdCliError';
    this.code = failure.code;
    this.details = details;
  }
}

// Windows NTSTATUS values surfaced as process exit codes when the exe itself
// can't start because a DLL is missing/mismatched. Node reports them either
// as unsigned (3221225781) or signed (-1073741515) depending on the path.
const DLL_EXIT_CODES = new Set([
  0xc0000135, -1073741515, // STATUS_DLL_NOT_FOUND
  0xc0000139, -1073741511, // STATUS_ENTRYPOINT_NOT_FOUND (mismatched DLL set)
  0xc0000142, -1073741502, // STATUS_DLL_INIT_FAILED
]);

// Spawn-level failures (binary missing/unreadable) — the runner feeds the
// spawn error message through the classifier with a null exit code.
const MISSING_DLL_PATTERNS = [
  /sd-cli process error/i,
  /\bENOENT\b/,
  /\bEACCES\b/,
  /\.dll[^\n]*(not found|missing|could not be located)/i,
  /(not found|missing|could not be located)[^\n]*\.dll/i,
];

const OUT_OF_MEMORY_PATTERNS = [
  /out of memory/i,
  /failed to allocate/i,
  /ggml[^\n]*alloc[^\n]*failed/i,
  /erroroutofdevicememory/i, // Vulkan vk::Device::allocateMemory
  /erroroutofhostmemory/i,
  /vk_error_out_of_(device|host)_memory/i,
];

const UNSUPPORTED_PATTERNS = [
  /unknown architecture/i,
  /unsupported/i,
];

const CORRUPT_PATTERNS = [
  /read tensor data failed/i,
  /load tensors from model loader failed/i,
  /failed to load model/i,
  /init model loader from file failed/i,
];

function matchesAny(output: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(output));
}

/**
 * Classify an sd-cli failure from its exit code and combined stdout/stderr.
 * Output-based signatures win over exit-code heuristics; a null exit code
 * with no recognizable output means the process was killed (cancel).
 */
export function classifySdCliFailure(
  exitCode: number | null,
  output: string,
): SdCliFailure {
  if (matchesAny(output, MISSING_DLL_PATTERNS)) {
    return {
      code: 'missing-dll',
      message: "sd-cli couldn't start — its binary or DLLs are missing or mismatched.",
      hint: 'Reinstall or update the bundled sd-cli.',
    };
  }

  if (matchesAny(output, OUT_OF_MEMORY_PATTERNS)) {
    return {
      code: 'out-of-memory',
      message: 'Ran out of GPU memory. Enable CPU offload or choose a smaller model.',
      hint: 'Lowering the resolution or moving CLIP/VAE to CPU also helps.',
    };
  }

  if (matchesAny(output, UNSUPPORTED_PATTERNS)) {
    return {
      code: 'unsupported-model',
      message: "sd-cli doesn't recognize this model's architecture. This model needs a newer sd-cli build.",
    };
  }

  if (matchesAny(output, CORRUPT_PATTERNS)) {
    return {
      code: 'corrupt-model',
      message: 'This model file looks incomplete or corrupt. Delete it and re-download.',
    };
  }

  if (exitCode !== null && DLL_EXIT_CODES.has(exitCode)) {
    return {
      code: 'missing-dll',
      message: "sd-cli couldn't start — its binary or DLLs are missing or mismatched.",
      hint: 'Reinstall or update the bundled sd-cli.',
    };
  }

  if (exitCode === null) {
    return {
      code: 'cancelled',
      message: 'Generation was cancelled.',
    };
  }

  return {
    code: 'unknown',
    message: `Image generation failed (sd-cli exit code ${exitCode}).`,
    hint: 'See details for the sd-cli output.',
  };
}
