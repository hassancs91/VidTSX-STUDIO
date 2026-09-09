// The project script (W4): the intended final read, edited in the Script
// tab and persisted on the document by the renderer's single-writer save.
// This is the ONE service both readers use — the agent's `get_script` tool
// and the system-prompt head come through here, never through a second
// copy of the text.

import { loadProject } from './project-store';

/** How much of the script rides in the system prompt; the rest is on demand. */
export const SCRIPT_CONTEXT_CHARS = 1500;
/** Default slice `get_script` returns per call. */
export const SCRIPT_SLICE_CHARS = 6000;

/** The script as saved, or undefined when the project has none (or cannot
 *  be read — a script problem must never fail a tool). */
export async function readProjectScript(projectId: string): Promise<string | undefined> {
  try {
    const script = (await loadProject(projectId)).script;
    return script && script.trim() !== '' ? script : undefined;
  } catch {
    return undefined;
  }
}

export interface ScriptHead {
  head: string;
  /** Characters not included in `head`. */
  remaining: number;
  total: number;
}

/** The first `max` characters, cut back to a whitespace boundary so the
 *  prompt never ends mid-word. */
export function scriptHead(script: string, max = SCRIPT_CONTEXT_CHARS): ScriptHead {
  const total = script.length;
  if (total <= max) return { head: script, remaining: 0, total };
  let cut = script.lastIndexOf(' ', max);
  const newline = script.lastIndexOf('\n', max);
  cut = Math.max(cut, newline);
  if (cut < max / 2) cut = max;
  const head = script.slice(0, cut).trimEnd();
  return { head, remaining: total - head.length, total };
}

export interface ScriptSlice {
  text: string;
  start: number;
  end: number;
  total: number;
}

/** A window of the script by character offset, clamped to the text. */
export function scriptSlice(script: string, start = 0, max = SCRIPT_SLICE_CHARS): ScriptSlice {
  const total = script.length;
  const from = Math.min(Math.max(0, Math.floor(start)), total);
  const to = Math.min(total, from + Math.max(1, Math.floor(max)));
  return { text: script.slice(from, to), start: from, end: to, total };
}
