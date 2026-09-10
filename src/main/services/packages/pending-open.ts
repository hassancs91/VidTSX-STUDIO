// Double-clicking a package file — `.vidtsx` (Q7a), `.vidtsxagent` (agents
// plan §1.6) or `.vidtsxflow` (flows plan §1.7, W8 Stage 6).
//
// The OS hands the path to the app three different ways — an argv on cold
// start, an argv on the `second-instance` event (this app holds a
// single-instance lock), and `open-file` on macOS — so all three funnel into
// ONE pending slot here, and the renderer claims it when the screen that can
// act on it is actually up.
//
// Why a pending slot rather than a straight push to the window: the app can be
// launched into any screen, and the target screen may not be mounted yet. The
// push event's only job is navigation; the PATH survives in main until
// something is ready to act on it, so a cold-start double-click cannot land in
// a window that is not listening.
//
// The slot carries a KIND because two screens claim from it. A claim names the
// kind it can handle and gets nothing when the waiting file is the other sort —
// otherwise whichever screen mounted first would swallow the other's package
// and silently drop it. It lives here rather than under `services/studio/`
// precisely because it is no longer Studio's alone (agreed 2026-09-08).

import path from 'path';
import { VIDTSX_PACKAGE_EXTENSION } from '../../../shared/studio/project-package';
import { AGENT_PACKAGE_EXT } from '../../../shared/agents/manifest';
import { FLOW_PACKAGE_EXT } from '../../../shared/flows/flow-package';

export type PendingPackageKind = 'project' | 'agent' | 'flow';

export interface PendingPackage {
  kind: PendingPackageKind;
  filePath: string;
}

const BY_EXTENSION: Record<string, PendingPackageKind> = {
  [VIDTSX_PACKAGE_EXTENSION]: 'project',
  [AGENT_PACKAGE_EXT]: 'agent',
  // The Flows screen claims this kind on mount (`FLOWS_PENDING_PACKAGE`);
  // `src/main/index.ts` still nudges only the two older kinds — a cold-start
  // double-click on a flow lands when the user opens Flows.
  [FLOW_PACKAGE_EXT]: 'flow',
};

let pending: PendingPackage | null = null;

/**
 * The first package path in a process argv, or null. Electron argv also
 * carries switches and (in dev) the app directory, so this looks at the
 * extension rather than at position — and never at argv[0], which is the
 * executable.
 */
export function packageFromArgv(argv: readonly string[]): PendingPackage | null {
  for (const arg of argv.slice(1)) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    const kind = BY_EXTENSION[path.extname(arg).toLowerCase()];
    if (kind) return { kind, filePath: arg };
  }
  return null;
}

/** The kind a path would open as, for the `open-file` event that has no argv. */
export function packageKindFor(filePath: string): PendingPackageKind | null {
  return BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null;
}

export function setPendingPackage(pkg: PendingPackage): void {
  pending = pkg;
}

/**
 * Read and clear, for the one kind the caller can handle. Claiming is one-shot:
 * two windows must not both import. A pending file of the OTHER kind is left
 * exactly where it is for the screen that owns it.
 */
export function takePendingPackage(kind: PendingPackageKind): string | null {
  if (!pending || pending.kind !== kind) return null;
  const { filePath } = pending;
  pending = null;
  return filePath;
}

/** Whether anything is waiting — any kind, or one in particular. */
export function hasPendingPackage(kind?: PendingPackageKind): boolean {
  if (!pending) return false;
  return kind === undefined || pending.kind === kind;
}

/** Test-only: drop whatever is parked, whichever kind it is. */
export function clearPendingPackage(): void {
  pending = null;
}
