import fs from 'fs/promises';
import path from 'path';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** Turns passed to the LLM are capped so old projects don't bloat the prompt. */
export const CHAT_CONTEXT_LIMIT = 20;

function chatPath(folderPath: string): string {
  return path.join(folderPath, 'chat.json');
}

/** Read a project's refinement conversation; missing/corrupt file → empty. */
export async function readChatHistory(folderPath: string): Promise<ChatTurn[]> {
  try {
    const raw = await fs.readFile(chatPath(folderPath), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is ChatTurn =>
      t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string');
  } catch {
    return [];
  }
}

/** Append turns to a project's chat.json (read-modify-write; jobs are serialized per project by UI flow). */
export async function appendChatTurns(folderPath: string, turns: Omit<ChatTurn, 'timestamp'>[]): Promise<void> {
  const existing = await readChatHistory(folderPath);
  const timestamp = new Date().toISOString();
  const next = [...existing, ...turns.map((t) => ({ ...t, timestamp }))];
  await fs.writeFile(chatPath(folderPath), JSON.stringify(next, null, 2), 'utf-8');
}
