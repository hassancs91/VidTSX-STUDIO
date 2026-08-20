import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('./studio-paths', () => ({
  getProjectDir: (projectId: string) => Promise.resolve(path.join(tmpRoot, projectId)),
}));

import { loadAgentChat, saveAgentChat, resetAgentChat } from './agent-chat-store';
import type { StudioAgentChatMessage } from '../../../shared/ipc/types/studio';

let tmpRoot: string;
const projectId = 'proj';

function msg(id: string, role: 'user' | 'assistant', text: string): StudioAgentChatMessage {
  return { id, role, text };
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-chat-'));
  await fs.mkdir(path.join(tmpRoot, projectId), { recursive: true });
});

describe('agent-chat-store', () => {
  it('round-trips messages and returns [] when no file exists', async () => {
    expect(await loadAgentChat(projectId)).toEqual([]);
    const messages = [
      msg('m1', 'user', 'do an editorial pass'),
      { ...msg('m2', 'assistant', 'Proposed 9 cuts.'), toolCalls: [{ tool: 'propose_cuts' }] },
    ];
    await saveAgentChat(projectId, messages);
    expect(await loadAgentChat(projectId)).toEqual(messages);
  });

  it('sets a corrupt file aside instead of deleting it', async () => {
    const filePath = path.join(tmpRoot, projectId, 'agent-chat.json');
    await fs.writeFile(filePath, '{not json', 'utf-8');
    expect(await loadAgentChat(projectId)).toEqual([]);
    const entries = await fs.readdir(path.join(tmpRoot, projectId));
    expect(entries.some((e) => /^agent-chat\.corrupt\.\d+\.json$/.test(e))).toBe(true);
    expect(entries).not.toContain('agent-chat.json');
  });

  it('drops malformed rows but keeps valid ones', async () => {
    const filePath = path.join(tmpRoot, projectId, 'agent-chat.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ version: 1, updatedAt: 'x', messages: [msg('m1', 'user', 'hi'), { bad: true }] }),
      'utf-8',
    );
    expect(await loadAgentChat(projectId)).toEqual([msg('m1', 'user', 'hi')]);
  });

  it('reset rotates the file and prunes to the newest 3 rotations', async () => {
    const dir = path.join(tmpRoot, projectId);
    // Three pre-existing rotations, oldest first.
    for (const stamp of [1000, 2000, 3000]) {
      await fs.writeFile(path.join(dir, `agent-chat.${stamp}.json`), '{}', 'utf-8');
    }
    await saveAgentChat(projectId, [msg('m1', 'user', 'latest conversation')]);
    await resetAgentChat(projectId);

    const entries = await fs.readdir(dir);
    expect(entries).not.toContain('agent-chat.json'); // rotated away
    const rotations = entries.filter((e) => /^agent-chat\.\d+\.json$/.test(e));
    expect(rotations).toHaveLength(3); // pruned to newest 3
    expect(rotations).not.toContain('agent-chat.1000.json'); // oldest gone
    expect(await loadAgentChat(projectId)).toEqual([]); // fresh conversation
  });

  it('reset with no transcript is a no-op', async () => {
    await expect(resetAgentChat(projectId)).resolves.toBeUndefined();
  });
});
