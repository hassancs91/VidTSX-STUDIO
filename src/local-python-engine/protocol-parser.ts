/**
 * JSON-lines parser for the worker protocol. Tolerant by construction: stdout arrives in
 * arbitrary chunks (a line can be split across two `data` events, several lines can share
 * one), and a library may still manage to print to fd 1 — anything that is not a JSON
 * object with a known `type` is dropped, never thrown. Pure; unit-tested with fixtures.
 */
import type { PythonProtocolErrorCode, PythonProtocolEvent } from './types';

const KNOWN_TYPES = new Set(['ready', 'stage', 'progress', 'result', 'error']);

/** Parse one trimmed line; null when it is not a protocol event. */
export function parseProtocolLine(line: string): PythonProtocolEvent | null {
  const t = line.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== 'string' || !KNOWN_TYPES.has(obj.type)) return null;

  switch (obj.type) {
    case 'ready':
      return {
        type: 'ready',
        torch: typeof obj.torch === 'string' ? obj.torch : null,
        cuda: obj.cuda === true,
        device: typeof obj.device === 'string' ? obj.device : 'unknown',
        vramMb: typeof obj.vramMb === 'number' ? obj.vramMb : 0,
        ...(typeof obj.python === 'string' ? { python: obj.python } : {}),
        ...(typeof obj.importSeconds === 'number' ? { importSeconds: obj.importSeconds } : {}),
        ...(typeof obj.onnxruntime === 'string' ? { onnxruntime: obj.onnxruntime } : {}),
        ...(Array.isArray(obj.providers) ? { providers: obj.providers.filter((p): p is string => typeof p === 'string') } : {}),
      };
    case 'stage':
      return typeof obj.name === 'string' && obj.name.length > 0 ? { type: 'stage', name: obj.name } : null;
    case 'progress': {
      const pct = typeof obj.pct === 'number' && Number.isFinite(obj.pct) ? Math.max(0, Math.min(100, obj.pct)) : null;
      if (pct === null || typeof obj.stage !== 'string') return null;
      return { type: 'progress', stage: obj.stage, pct };
    }
    case 'result':
      return {
        type: 'result',
        outputPath: typeof obj.outputPath === 'string' ? obj.outputPath : null,
        stats: typeof obj.stats === 'object' && obj.stats !== null && !Array.isArray(obj.stats) ? (obj.stats as Record<string, unknown>) : {},
      };
    case 'error':
      return {
        type: 'error',
        code: isErrorCode(obj.code) ? obj.code : 'unknown',
        message: typeof obj.message === 'string' && obj.message ? obj.message : 'The worker reported an error without a message.',
      };
    default:
      return null;
  }
}

const ERROR_CODES = new Set(['oom', 'cuda-mismatch', 'import', 'weights-corrupt', 'cancelled', 'bad-request', 'network', 'unknown']);

function isErrorCode(v: unknown): v is PythonProtocolErrorCode {
  return typeof v === 'string' && ERROR_CODES.has(v);
}

/**
 * Incremental parser: feed raw chunks, get events. `flush()` handles a final line
 * without a trailing newline (the worker always ends lines, but a killed process may not).
 */
export function createProtocolParser(onEvent: (event: PythonProtocolEvent) => void): {
  push(chunk: string): void;
  flush(): void;
} {
  let buffer = '';
  const consume = (line: string) => {
    const evt = parseProtocolLine(line);
    if (evt) onEvent(evt);
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        consume(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
      }
    },
    flush() {
      if (buffer.trim()) consume(buffer);
      buffer = '';
    },
  };
}
