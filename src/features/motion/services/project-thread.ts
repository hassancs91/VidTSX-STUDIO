// The open project's conversation as a thread (P3 part 3): its chat.json, which
// every job that saves a version appends to — a build's prompt and reply, a
// builder edit, the pipeline's generate / edit / fix, Studio's generate and
// refine in a shot folder. A builder reply carries the version it saved and
// the builder's own summary; older replies name their version in the text.

export interface ThreadTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  /** A reply: the version it saved, when it can be told. */
  version: number | null;
  /** A builder reply: what the builder says it did. */
  summary?: string;
}

/** The latest exchange shows; the rest folds behind "N earlier". */
export const THREAD_COLLAPSED_TURNS = 2;

/** "Built v1 (…)", "Applied edit — saved as v2.tsx.", "Generated v1.tsx (…)": the version a reply names. */
function versionInText(content: string): number | null {
  const match = /\bv(\d+)(?:\.tsx)?\b/.exec(content);
  return match ? Number(match[1]) : null;
}

/** chat.json's text → the thread; anything unreadable is an empty thread. */
export function parseThread(raw: string | null | undefined): ThreadTurn[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const turns: ThreadTurn[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if ((t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string') continue;
    const version =
      t.role === 'assistant'
        ? typeof t.version === 'number' ? t.version : versionInText(t.content)
        : null;
    turns.push({
      role: t.role,
      content: t.content,
      ...(typeof t.timestamp === 'string' ? { timestamp: t.timestamp } : {}),
      version,
      ...(typeof t.summary === 'string' && t.summary.trim() ? { summary: t.summary.trim() } : {}),
    });
  }
  return turns;
}

/** What shows: everything when expanded, else the latest exchange; `hidden` = how many fold away. */
export function visibleTurns(turns: ThreadTurn[], expanded: boolean): { shown: ThreadTurn[]; hidden: number } {
  if (expanded || turns.length <= THREAD_COLLAPSED_TURNS) return { shown: turns, hidden: 0 };
  return { shown: turns.slice(-THREAD_COLLAPSED_TURNS), hidden: turns.length - THREAD_COLLAPSED_TURNS };
}

/** The file of version `n` in `folderPath`: the library's own path when it lists it, else built with the folder's separator. */
export function threadVersionPath(folderPath: string, n: number, versions: string[]): string {
  const listed = versions.find((v) => new RegExp(`[\\\\/]v${n}\\.tsx$`, 'i').test(v));
  if (listed) return listed;
  const sep = folderPath.includes('\\') && !folderPath.includes('/') ? '\\' : '/';
  return `${folderPath.replace(/[\\/]+$/, '')}${sep}v${n}.tsx`;
}
