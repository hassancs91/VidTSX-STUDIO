// User Timing marks for the project-open path (video-10 feedback item 2).
//
// Every stage of opening a project drops a `studio-open:<stage>` mark on the
// renderer's performance timeline, so an open can be profiled from a CDP
// driver (`performance.getEntriesByType('mark')`) without wrapping the
// preload API. Marks are cheap and cleared at the start of each open, so they
// never accumulate across a long session. Never throws: a timeline that
// refuses a mark must not break the editor.

export const OPEN_MARK_PREFIX = 'studio-open:';

export function markOpen(stage: string): void {
  try {
    performance.mark(`${OPEN_MARK_PREFIX}${stage}`);
  } catch {
    // Timing is diagnostics only.
  }
}

/** Drop the previous open's marks (call once, when an open starts). */
export function resetOpenMarks(): void {
  try {
    for (const entry of performance.getEntriesByType('mark')) {
      if (entry.name.startsWith(OPEN_MARK_PREFIX)) performance.clearMarks(entry.name);
    }
  } catch {
    // Timing is diagnostics only.
  }
}
