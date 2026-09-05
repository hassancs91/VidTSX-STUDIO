import { describe, expect, it } from 'vitest';
import { classifyPythonFailure, EXIT_NAME_TOO_LONG, PythonRunError } from './python-failure';
import type { PythonFailureCode, PythonFailureInput } from './types';

const cases: Array<[string, PythonFailureInput, PythonFailureCode, RegExp]> = [
  ['cancel wins over everything', { cancelled: true, exitCode: 1, protocolError: { type: 'error', code: 'oom', message: 'x' } }, 'cancelled', /Cancelled/],
  ['protocol oom', { exitCode: 1, protocolError: { type: 'error', code: 'oom', message: 'Ran out of memory (GPU). CUDA out of memory.' } }, 'oom', /Ran out of memory/],
  ['protocol cuda-mismatch', { exitCode: 1, protocolError: { type: 'error', code: 'cuda-mismatch', message: 'driver' } }, 'cuda-mismatch', /driver/],
  ['protocol import → Repair hint', { exitCode: 1, protocolError: { type: 'error', code: 'import', message: "No module named 'einops'" } }, 'import', /einops/],
  ['protocol import quoting a > MAX_PATH module file → path-too-long (Stage 5 long-root run)', { exitCode: 1, protocolError: { type: 'error', code: 'import', message: `cannot import name 'onnxruntime_validation' from 'onnxruntime.capi' (C:\\Users\\Malak\\${'x'.repeat(230)}\\python\\Lib\\site-packages\\onnxruntime\\capi\\__init__.py)` } }, 'path-too-long', /too long/],
  ['protocol weights-corrupt', { exitCode: 1, protocolError: { type: 'error', code: 'weights-corrupt', message: 'central directory' } }, 'weights-corrupt', /central directory/],
  ['protocol bad-request', { exitCode: 1, protocolError: { type: 'error', code: 'bad-request', message: 'Input image not found: x' } }, 'bad-request', /Input image not found/],
  ['protocol network = app bug', { exitCode: 1, protocolError: { type: 'error', code: 'network', message: 'ConnectionError github.com' } }, 'network', /github/],
  ['protocol unknown', { exitCode: 1, protocolError: { type: 'error', code: 'unknown', message: 'RuntimeError: boom' } }, 'unknown', /boom/],
  ['protocol cancelled (SIGINT inside the worker)', { exitCode: 1, protocolError: { type: 'error', code: 'cancelled', message: 'Generation was cancelled.' } }, 'cancelled', /Cancelled/],
  ['spawn failure (ENOENT)', { exitCode: null, spawnError: 'spawn C:\\x\\python.exe ENOENT' }, 'spawn', /could not be started/],
  ['idle timeout', { exitCode: null, timedOut: true }, 'timeout', /stopped responding/],
  ['0xC0000106 unsigned → path-too-long', { exitCode: EXIT_NAME_TOO_LONG }, 'path-too-long', /too long/],
  ['0xC0000106 signed → path-too-long', { exitCode: -1073741562 }, 'path-too-long', /too long/],
  ['STATUS_DLL_NOT_FOUND → import', { exitCode: 0xc0000135 }, 'import', /DLL/],
  ['exit 0 without a result line', { exitCode: 0, noResult: true }, 'no-result', /without producing a result/],
  ['killed from outside', { exitCode: null }, 'exit', /terminated/],
  ['plain non-zero exit', { exitCode: 3 }, 'exit', /code 3/],
];

describe('classifyPythonFailure', () => {
  for (const [name, input, code, re] of cases) {
    it(name, () => {
      const f = classifyPythonFailure(input);
      expect(f.code).toBe(code);
      expect(f.message).toMatch(re);
    });
  }

  it('does not repeat the Repair hint the runner already wrote (Stage 5 error-matrix copy check)', () => {
    const f = classifyPythonFailure({ exitCode: 1, protocolError: { type: 'error', code: 'import', message: "The AI runtime is incomplete or damaged (No module named 'einops'). Use Repair on the AI Runtime row." } });
    expect(f.code).toBe('import');
    expect(f.hint).toBeUndefined();
    expect(new PythonRunError(f, '').message.match(/Repair/g)).toHaveLength(1);
  });

  it('PythonRunError carries code, hint and the raw details', () => {
    const err = new PythonRunError(classifyPythonFailure({ exitCode: 1, protocolError: { type: 'error', code: 'import', message: 'm' } }), 'raw tail');
    expect(err.code).toBe('import');
    expect(err.details).toBe('raw tail');
    expect(err.hint).toMatch(/Repair/);
    expect(err.message).toMatch(/^m /);
    expect(err.isCancelled).toBe(false);
  });
});
