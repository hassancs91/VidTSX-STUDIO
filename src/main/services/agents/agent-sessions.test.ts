import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The session store builds every path from `getAgentSessionsDir()`, so the
// whole file is exercised by pointing userData at a temp folder.
let userData = '';
vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    isPackaged: false,
    getAppPath: () => userData,
    getVersion: () => '1.0.0',
  },
}));

import {
  agentSessionDir,
  agentWorkspaceDir,
  appendAgentChat,
  cleanTitle,
  createAgentSession,
  deleteAgentSession,
  listAgentSessions,
  patchAgentSession,
  readAgentChat,
  readAgentSession,
  setPendingInteraction,
  writeAgentChat,
  CHAT_FILE_NAME,
  SESSION_FILE_NAME,
} from './agent-sessions';
import type { InteractionRequest } from '../../../shared/types/agents';

const AGENT_ID = 'vidtsx/motion-post';

async function make(title?: string) {
  return createAgentSession({
    agentId: AGENT_ID,
    agentName: 'Motion Post',
    agentVersion: '1.0.0',
    ...(title ? { title } : {}),
  });
}

beforeEach(async () => {
  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-sessions-'));
});

afterEach(async () => {
  await fs.rm(userData, { recursive: true, force: true });
});

describe('createAgentSession', () => {
  it('writes session.json and the work folder, and fixes the library folder', async () => {
    const session = await make('Launch teaser');

    expect(session.title).toBe('Launch teaser');
    // §1.11: `agents/<agent-name>/<session-title>`, both slugified.
    expect(session.libraryFolder).toBe('agents/motion-post/launch-teaser');
    await expect(
      fs.stat(path.join(agentSessionDir(AGENT_ID, session.id), SESSION_FILE_NAME)),
    ).resolves.toBeDefined();
    await expect(fs.stat(agentWorkspaceDir(AGENT_ID, session.id))).resolves.toBeDefined();
  });

  it('keeps the library folder when the session is renamed', async () => {
    const session = await make('Launch teaser');
    const renamed = await patchAgentSession(AGENT_ID, session.id, { title: 'Something else' });

    // Renaming must not move media the artifacts already point at (§1.11).
    expect(renamed?.title).toBe('Something else');
    expect(renamed?.libraryFolder).toBe('agents/motion-post/launch-teaser');
  });
});

describe('listAgentSessions', () => {
  it('is empty for an agent that has never run', async () => {
    await expect(listAgentSessions(AGENT_ID)).resolves.toEqual([]);
  });

  it('sorts most recently opened first and counts artifacts', async () => {
    const first = await make('First');
    const second = await make('Second');
    await patchAgentSession(AGENT_ID, first.id, { lastOpenedAt: '2030-01-01T00:00:00.000Z' });
    await fs.writeFile(
      path.join(agentSessionDir(AGENT_ID, second.id), 'artifacts.json'),
      JSON.stringify({
        version: 1,
        artifacts: [
          { id: 'image-set-1', kind: 'image-set', title: 'A', createdAt: '', producer: { tool: 't', callId: 'c' }, payload: { items: [{ relPath: 'agents/a/b.png', width: 1, height: 1 }] } },
        ],
      }),
      'utf-8',
    );

    const sessions = await listAgentSessions(AGENT_ID);
    expect(sessions.map((s) => s.id)).toEqual([first.id, second.id]);
    expect(sessions[1].artifactCount).toBe(1);
    // The newest visual artifact becomes the list thumbnail.
    expect(sessions[1].thumbnailRelPath).toBe('agents/a/b.png');
  });

  it('skips a session whose record will not parse, and rotates it aside', async () => {
    const good = await make('Good');
    const bad = await make('Bad');
    const badFile = path.join(agentSessionDir(AGENT_ID, bad.id), SESSION_FILE_NAME);
    await fs.writeFile(badFile, '{ not json', 'utf-8');

    const sessions = await listAgentSessions(AGENT_ID);
    expect(sessions.map((s) => s.id)).toEqual([good.id]);

    // Rotated, never deleted (the store rule).
    const left = await fs.readdir(agentSessionDir(AGENT_ID, bad.id));
    expect(left.some((f) => f.includes('.corrupt.'))).toBe(true);
  });

  it('rotates a record that parses but is not a session', async () => {
    // Bad JSON was already safe; GOOD json of the wrong shape used to fall
    // through to the caller's default with nothing set aside to show for it.
    const bad = await make('Bad');
    const badFile = path.join(agentSessionDir(AGENT_ID, bad.id), SESSION_FILE_NAME);
    await fs.writeFile(badFile, JSON.stringify({ id: 42, title: null }), 'utf-8');

    expect(await readAgentSession(AGENT_ID, bad.id)).toBeNull();
    const left = await fs.readdir(agentSessionDir(AGENT_ID, bad.id));
    expect(left.some((f) => f.includes('.corrupt.'))).toBe(true);
    expect(left).not.toContain(SESSION_FILE_NAME);
  });
});

describe('corrupt chat.json', () => {
  // The transcript is the one file where "read as empty" is actively
  // destructive: the very next append writes the empty list back over the
  // history. So a chat file that will not parse, and one that parses into the
  // wrong shape, are both rotated aside rather than read as nothing.
  it.each([
    ['unparseable', '{ "messages": ['],
    ['parsed but not a chat', JSON.stringify({ version: 1, messages: 'lost' })],
    ['parsed but not an object', JSON.stringify(['a', 'b'])],
  ])('rotates a %s transcript instead of silently emptying it', async (_name, body) => {
    const session = await make();
    await writeAgentChat(AGENT_ID, session.id, [
      { id: 'm1', role: 'user', text: 'the history that must not vanish' },
    ]);
    const chatFile = path.join(agentSessionDir(AGENT_ID, session.id), CHAT_FILE_NAME);
    await fs.writeFile(chatFile, body, 'utf-8');

    expect(await readAgentChat(AGENT_ID, session.id)).toEqual([]);
    const left = await fs.readdir(agentSessionDir(AGENT_ID, session.id));
    expect(left.some((f) => f.startsWith('chat.corrupt.'))).toBe(true);
    expect(left).not.toContain(CHAT_FILE_NAME);
  });

  it('leaves a good transcript alone and appends to it', async () => {
    const session = await make();
    await writeAgentChat(AGENT_ID, session.id, [{ id: 'm1', role: 'user', text: 'one' }]);
    await appendAgentChat(AGENT_ID, session.id, [{ id: 'm2', role: 'assistant', text: 'two' }]);
    expect((await readAgentChat(AGENT_ID, session.id)).map((m) => m.text)).toEqual([
      'one',
      'two',
    ]);
    const left = await fs.readdir(agentSessionDir(AGENT_ID, session.id));
    expect(left.some((f) => f.includes('.corrupt.'))).toBe(false);
  });
});

describe('pending interactions', () => {
  it('round-trips a question and clears it', async () => {
    const session = await make();
    const request: InteractionRequest = {
      id: 'q-1',
      sessionId: session.id,
      callId: 'call-1',
      createdAt: new Date().toISOString(),
      payload: {
        kind: 'pick',
        title: 'Which hook?',
        candidates: [{ id: 'a', label: 'Hook A' }],
        select: 'one',
      },
    };

    await setPendingInteraction(AGENT_ID, session.id, request);
    expect((await readAgentSession(AGENT_ID, session.id))?.pendingInteraction?.id).toBe('q-1');

    await setPendingInteraction(AGENT_ID, session.id, null);
    expect((await readAgentSession(AGENT_ID, session.id))?.pendingInteraction).toBeUndefined();
  });

  it('drops a malformed question rather than handing it to a card', async () => {
    // A hand-edited or truncated session.json. The zod at the tool boundary
    // never saw this — the question was written before the app closed — so the
    // read path is the only place that can catch it (§7).
    const session = await make();
    const file = path.join(agentSessionDir(AGENT_ID, session.id), 'session.json');
    const raw = JSON.parse(await fs.readFile(file, 'utf-8')) as Record<string, unknown>;
    raw.pendingInteraction = {
      id: 'q-2',
      sessionId: session.id,
      callId: 'call-2',
      createdAt: new Date().toISOString(),
      // A pick with nothing to click — the tool refuses this too.
      payload: { kind: 'pick', title: 'Which?', candidates: [], select: 'one' },
    };
    await fs.writeFile(file, JSON.stringify(raw), 'utf-8');

    const loaded = await readAgentSession(AGENT_ID, session.id);
    // The session still opens; only the unanswerable question is gone.
    expect(loaded?.id).toBe(session.id);
    expect(loaded?.pendingInteraction).toBeUndefined();
  });
});

describe('chat', () => {
  it('appends turns without rewriting what it did not touch', async () => {
    const session = await make();
    await appendAgentChat(AGENT_ID, session.id, [{ id: 'a', role: 'user', text: 'hi' }]);
    await appendAgentChat(AGENT_ID, session.id, [{ id: 'b', role: 'assistant', text: 'hello' }]);

    const messages = await readAgentChat(AGENT_ID, session.id);
    expect(messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('reads as empty for a session with no chat yet', async () => {
    const session = await make();
    await expect(readAgentChat(AGENT_ID, session.id)).resolves.toEqual([]);
  });
});

describe('deleteAgentSession', () => {
  it('removes the folder and nothing else', async () => {
    const kept = await make('Kept');
    const gone = await make('Gone');
    await deleteAgentSession(AGENT_ID, gone.id);

    expect((await listAgentSessions(AGENT_ID)).map((s) => s.id)).toEqual([kept.id]);
    await expect(fs.stat(agentSessionDir(AGENT_ID, gone.id))).rejects.toThrow();
  });
});

describe('cleanTitle', () => {
  it('collapses whitespace and falls back when empty', () => {
    expect(cleanTitle('  a   b  ', 'x')).toBe('a b');
    expect(cleanTitle('   ', 'New session')).toBe('New session');
    expect(cleanTitle(undefined, 'New session')).toBe('New session');
  });
});
