// Persisted Assistant transcript (SHOT_QUALITY_DESIGN.md Q1d).
//
// Lives beside project.json — the conversation is work-product and travels
// with a handed-off project folder. NEVER under cache/: Clear Cache must not
// eat a conversation. The renderer owns the live message list and
// write-behinds after each completed turn; main only does disk I/O here.
//
// A corrupt file is set aside (renamed), never deleted — the memory-store
// precedent. Reset rotates the current file to agent-chat.<ts>.json and keeps
// the newest 3 rotations: once persistence exists, reset is a user choice and
// an accidental one must not destroy history.

import fs from 'fs/promises';
import path from 'path';
import type { StudioAgentChatMessage } from '../../../shared/ipc/types/studio';
import { getProjectDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentChatStore');

const FILE_NAME = 'agent-chat.json';
const ROTATED_PATTERN = /^agent-chat\.(\d+)\.json$/;
const ROTATED_KEEP = 3;

interface PersistedAgentChat {
  version: 1;
  updatedAt: string;
  messages: StudioAgentChatMessage[];
}

function isMessage(raw: unknown): raw is StudioAgentChatMessage {
  if (typeof raw !== 'object' || raw === null) return false;
  const m = raw as Partial<StudioAgentChatMessage>;
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.text === 'string'
  );
}

async function chatFilePath(projectId: string): Promise<string> {
  return path.join(await getProjectDir(projectId), FILE_NAME);
}

export async function loadAgentChat(projectId: string): Promise<StudioAgentChatMessage[]> {
  const filePath = await chatFilePath(projectId);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return []; // No transcript yet.
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAgentChat>;
    if (!Array.isArray(parsed.messages)) throw new Error('missing messages array');
    return parsed.messages.filter(isMessage);
  } catch (err) {
    const asidePath = filePath.replace(/\.json$/, `.corrupt.${Date.now()}.json`);
    await fs.rename(filePath, asidePath).catch(() => {});
    log.warn('Corrupt agent chat set aside', {
      projectId,
      asidePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function saveAgentChat(
  projectId: string,
  messages: StudioAgentChatMessage[],
): Promise<void> {
  const filePath = await chatFilePath(projectId);
  const file: PersistedAgentChat = {
    version: 1,
    updatedAt: new Date().toISOString(),
    messages,
  };
  await fs.writeFile(filePath, JSON.stringify(file, null, 2), 'utf-8');
}

/** "New conversation": rotate the current transcript aside, keep newest 3. */
export async function resetAgentChat(projectId: string): Promise<void> {
  const filePath = await chatFilePath(projectId);
  const dir = path.dirname(filePath);
  try {
    await fs.rename(filePath, path.join(dir, `agent-chat.${Date.now()}.json`));
  } catch {
    return; // Nothing to rotate.
  }
  try {
    const entries = await fs.readdir(dir);
    const rotated = entries
      .map((name) => {
        const stamp = ROTATED_PATTERN.exec(name)?.[1];
        return stamp ? { name, stamp: Number(stamp) } : null;
      })
      .filter((e): e is { name: string; stamp: number } => e !== null)
      .sort((a, b) => b.stamp - a.stamp);
    for (const old of rotated.slice(ROTATED_KEEP)) {
      await fs.unlink(path.join(dir, old.name)).catch(() => {});
    }
  } catch (err) {
    log.warn('Failed to prune rotated agent chats', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
