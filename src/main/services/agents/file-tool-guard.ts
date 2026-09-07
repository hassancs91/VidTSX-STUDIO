// The SDK file-tool path guard (agents plan §1.2 step 4, decided 2026-09-06).
//
// When a manifest sets `workspace.sdkFileTools`, the run passes Read, Write,
// Edit, Glob and Grep to the SDK with the session workspace as `cwd`. This is
// the `canUseTool` permission hook that keeps them there: every path argument
// is resolved — `..` normalised, symlinks followed — and anything landing
// outside the workspace is DENIED with a message the model sees. WebSearch and
// WebFetch pass through. Any other tool name is denied, so a future SDK
// built-in cannot arrive switched on.
//
// This is the one piece of security code in the feature, so it is written to
// fail closed: an unrecognised argument shape, an unresolvable path, or a
// missing workspace all deny.

import fs from 'fs/promises';
import path from 'path';

export type FileToolDecision =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

/** Tool name → the input keys that carry a path. */
const PATH_ARGS: Record<string, readonly string[]> = {
  Read: ['file_path', 'notebook_path'],
  Write: ['file_path'],
  Edit: ['file_path', 'notebook_path'],
  Glob: ['path'],
  Grep: ['path'],
};

/** Passed straight through: they reach the network, not the disk. */
const NETWORK_TOOLS = new Set(['WebSearch', 'WebFetch']);

/**
 * Resolve as far as the filesystem actually goes, then append what does not
 * exist yet. `fs.realpath` throws on a path whose leaf is missing, which is the
 * ordinary case for Write — but the EXISTING prefix is exactly what can hide a
 * symlink out of the workspace, so that prefix must still be resolved.
 */
async function realpathDeep(target: string): Promise<string> {
  const resolved = path.resolve(target);
  let head = resolved;
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(await fs.realpath(head), ...tail);
    } catch {
      const parent = path.dirname(head);
      if (parent === head) return resolved; // Nothing on this path exists.
      tail.unshift(path.basename(head));
      head = parent;
    }
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Build the `canUseTool` callback for one session workspace.
 *
 * `workspaceDir` must exist; it is resolved once so a symlinked workspace
 * (a user data folder on another volume, say) compares correctly.
 */
export function createFileToolGuard(
  workspaceDir: string,
): (toolName: string, input: Record<string, unknown>) => Promise<FileToolDecision> {
  const rootPromise = realpathDeep(workspaceDir);

  return async (toolName, input) => {
    if (NETWORK_TOOLS.has(toolName)) return { behavior: 'allow', updatedInput: input };

    const keys = PATH_ARGS[toolName];
    if (!keys) {
      return {
        behavior: 'deny',
        message: `"${toolName}" is not available to this agent. You may use Read, Write, Edit, Glob and Grep inside your own session folder.`,
      };
    }

    const root = await rootPromise;
    for (const key of keys) {
      const value = input[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string' || value.trim() === '') {
        return { behavior: 'deny', message: `"${key}" must be a path.` };
      }
      // A relative path is relative to the workspace, which is the run's cwd.
      const resolved = await realpathDeep(path.resolve(root, value));
      if (!isInside(root, resolved)) {
        return {
          behavior: 'deny',
          message: `"${value}" is outside your session folder. You may only read and write inside it — use a relative path.`,
        };
      }
    }
    return { behavior: 'allow', updatedInput: input };
  };
}
