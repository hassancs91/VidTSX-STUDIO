// Zip entry-name safety — the FIRST of the two zip-slip gates, shared by every
// package format the app reads (`.vidtsx`, `.vidtsxagent`).
//
// Moved here from `shared/studio/project-package.ts` when the agents package
// format arrived (agents plan §5): the rule is about zip entry names, not about
// projects, and two copies of a security predicate is one copy too many.
// `project-package.ts` re-exports it, so its callers and tests are unchanged.

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const WINDOWS_ILLEGAL = /[<>:"|?*]/;

/** Longest entry path any format accepts, unless a caller asks for less. */
export const DEFAULT_MAX_ENTRY_PATH_LENGTH = 240;

/** Control characters (and DEL) never belong in a portable entry name. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Is this zip entry name safe to join onto an extraction root?
 *
 * Deliberately string-only (no `path`), so the check is identical in main, in
 * the renderer, and in tests — and so it runs BEFORE any resolve, which is
 * where zip-slip normally sneaks through. The reader still resolves and
 * re-checks containment afterwards; this is the first of the two gates.
 */
export function isSafeEntryPath(name: string, maxLength = DEFAULT_MAX_ENTRY_PATH_LENGTH): boolean {
  if (typeof name !== 'string') return false;
  if (name === '' || name.length > maxLength) return false;
  // A backslash is a path separator on Windows — a name carrying one is either
  // malicious or unportable, and both answers are "no".
  if (name.includes('\\')) return false;
  if (name.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(name)) return false;
  if (hasControlChars(name)) return false;
  if (WINDOWS_ILLEGAL.test(name)) return false;
  for (const segment of name.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return false;
    if (segment.endsWith('.') || segment.endsWith(' ')) return false;
    if (WINDOWS_RESERVED.test(segment.split('.')[0])) return false;
  }
  return true;
}
