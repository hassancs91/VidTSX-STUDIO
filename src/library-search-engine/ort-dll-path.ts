// Windows: the onnxruntime-node binding needs its onnxruntime.dll found through PATH. The same probe as the
// embedding / content-safety workers (dev: <repo>/node_modules, packaged: app.asar.unpacked), as a function so the
// gated live test can point it at a resolved package folder too. Must run before transformers.js is imported.

import { existsSync } from 'node:fs';
import path from 'node:path';

export function ortDllDirsBeside(baseDir: string): string[] {
  const subdir = path.join('bin', 'napi-v6', 'win32', process.arch);
  return [
    path.join(baseDir, '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(baseDir, '..', '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(baseDir, '..', '..', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', subdir),
  ];
}

/** Prepends the first candidate holding onnxruntime.dll to PATH (Windows only); returns it, or null. */
export function prependOrtDllPath(candidates: string[]): string | null {
  if (process.platform !== 'win32') return null;
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'onnxruntime.dll'))) {
      const current = process.env.PATH ?? '';
      if (!current.includes(dir)) process.env.PATH = `${dir};${current}`;
      return dir;
    }
  }
  return null;
}
