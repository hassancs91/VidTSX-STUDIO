/**
 * Where the assistant composer's unsent text lives between mounts.
 *
 * The right panel renders one tab at a time, so switching to Inspector (or
 * selecting a clip, which flips the tab) unmounts `AgentPanel` and would
 * throw a half-typed request away. The draft is keyed by project in
 * sessionStorage: it survives tab switches and a renderer reload, and goes
 * with the window when the app closes — a draft is not project data.
 */
export const AGENT_DRAFT_KEY_PREFIX = 'studio:agent-draft:';

/** The subset of the Storage interface the store needs (injectable for tests). */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function agentDraftKey(projectId: string): string {
  return `${AGENT_DRAFT_KEY_PREFIX}${projectId}`;
}

function defaultStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readAgentDraft(projectId: string, storage: DraftStorage | null = defaultStorage()): string {
  try {
    return storage?.getItem(agentDraftKey(projectId)) ?? '';
  } catch {
    return '';
  }
}

/** Writes the draft; an empty draft removes the entry so nothing lingers. */
export function writeAgentDraft(
  projectId: string,
  text: string,
  storage: DraftStorage | null = defaultStorage(),
): void {
  try {
    if (text.length === 0) storage?.removeItem(agentDraftKey(projectId));
    else storage?.setItem(agentDraftKey(projectId), text);
  } catch {
    // Storage full or blocked: the in-memory draft still works for this mount.
  }
}
