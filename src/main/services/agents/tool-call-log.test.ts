// The per-session call log (W8 Stage 5): appends serialise, a read after a
// write sees it, long strings are cut, and a missing file is an empty log.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let userData = '';
vi.mock('electron', () => ({
  app: { getPath: () => userData, isPackaged: false, getAppPath: () => userData, getVersion: () => '1.0.0' },
}));

import { agentSessionDir } from './agent-sessions';
import {
  appendInteractionReply,
  appendToolCall,
  CALLS_FILE_NAME,
  clearToolCallLogCacheForTests,
  readToolCallLog,
  sanitizeCallArgs,
} from './tool-call-log';

const AGENT = 'vidtsx/motion-post';

beforeEach(async () => {
  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-calls-'));
  clearToolCallLogCacheForTests();
});
afterEach(async () => {
  await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('tool-call-log', () => {
  it('reads an empty log for a session with none', async () => {
    expect(await readToolCallLog(AGENT, 's-none')).toEqual({ version: 1, calls: [], replies: [] });
  });

  it('appends calls and replies in order, even when fired together, and persists them', async () => {
    await Promise.all([
      appendToolCall(AGENT, 's-1', { callId: 'c1', tool: 'write_document', at: 't1', args: { title: 'a' }, artifactIds: ['document-1'] }),
      appendToolCall(AGENT, 's-1', { callId: 'c2', tool: 'ask_user', at: 't2', args: { question: 'q' }, artifactIds: [], requestIds: ['q-1'] }),
      appendInteractionReply(AGENT, 's-1', { requestId: 'q-1', at: 't3', status: 'answered', values: { a: ['A'] } }),
    ]);
    const log = await readToolCallLog(AGENT, 's-1');
    expect(log.calls.map((c) => c.callId)).toEqual(['c1', 'c2']);
    expect(log.replies).toEqual([{ requestId: 'q-1', at: 't3', status: 'answered', values: { a: ['A'] } }]);
    const onDisk = JSON.parse(await fs.readFile(path.join(agentSessionDir(AGENT, 's-1'), CALLS_FILE_NAME), 'utf-8')) as typeof log;
    expect(onDisk.calls).toHaveLength(2);
    clearToolCallLogCacheForTests();
    expect((await readToolCallLog(AGENT, 's-1')).calls).toHaveLength(2);
  });

  it('cuts long strings and leaves the rest alone', () => {
    const long = 'x'.repeat(250_000);
    const out = sanitizeCallArgs({ markdown: long, n: 2, list: [long, 'ok'], nested: { s: 'fine' } });
    expect((out.markdown as string).length).toBeLessThan(200_100);
    expect((out.markdown as string).endsWith('[truncated]')).toBe(true);
    expect(out.n).toBe(2);
    expect((out.list as string[])[1]).toBe('ok');
    expect(out.nested).toEqual({ s: 'fine' });
    expect(sanitizeCallArgs(undefined)).toEqual({});
  });
});
