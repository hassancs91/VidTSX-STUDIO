// Double-clicking a `.vidtsx` file (Q7a file association).
//
// The OS hands the path to the app three different ways — an argv on cold
// start, an argv on the `second-instance` event (this app holds a
// single-instance lock), and `open-file` on macOS — so all three funnel into
// ONE pending slot here, and the renderer claims it when the project browser
// is actually on screen.
//
// Why a pending slot rather than a straight push to the window: the app can be
// launched into any screen, and the Studio browser may not be mounted yet. The
// push event's only job is navigation; the PATH survives in main until
// something is ready to act on it, so a cold-start double-click cannot land in
// a window that is not listening.

import path from 'path';
import { VIDTSX_PACKAGE_EXTENSION } from '../../../shared/studio/project-package';

let pending: string | null = null;

/**
 * The first `.vidtsx` path in a process argv, or null. Electron argv also
 * carries switches and (in dev) the app directory, so this looks at the
 * extension rather than at position — and never at argv[0], which is the
 * executable.
 */
export function packagePathFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    if (path.extname(arg).toLowerCase() === VIDTSX_PACKAGE_EXTENSION) return arg;
  }
  return null;
}

export function setPendingPackage(filePath: string): void {
  pending = filePath;
}

/** Read and clear. Claiming is one-shot: two windows must not both import. */
export function takePendingPackage(): string | null {
  const filePath = pending;
  pending = null;
  return filePath;
}

export function hasPendingPackage(): boolean {
  return pending !== null;
}
