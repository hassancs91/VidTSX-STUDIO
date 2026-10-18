// P4-7: a message the user TYPES (the chat box's IPC path, sendFromUser)
// answers a waiting question as skipped; every other caller of `send` (job
// notes, card replies, run_agent, a freeze) leaves the question alone. The
// runner and the session files are faked: this is the service's routing.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'os';
import type { AgentSession } from '../../../shared/types/agents';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), getAppPath: () => os.tmpdir(), isPackaged: false } }));

const runner = {
  isRunning: vi.fn((_id: string) => false),
  skipPending: vi.fn(async (_s: AgentSession, _text: string): Promise<{ requestId: string; message: string } | null> => null),
};
vi.mock('./agent-runner', () => ({
  AgentRunner: class {
    isRunning = runner.isRunning;
    skipPending = runner.skipPending;
  },
}));
const readAgentSession = vi.fn();
vi.mock('./agent-sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./agent-sessions')>()),
  readAgentSession: (...args: unknown[]) => readAgentSession(...args),
}));
const appendInteractionReply = vi.fn(async () => {});
vi.mock('./tool-call-log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tool-call-log')>()),
  appendInteractionReply: (...args: unknown[]) => appendInteractionReply(...(args as [])),
}));

const { AgentService } = await import('./agent-service');

const SESSION = { id: 's-1', agentId: 'lwh/test' } as AgentSession;
const sent = { success: true, toolsAvailable: true, text: 'ok' };

let service: InstanceType<typeof AgentService>;
let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  runner.isRunning.mockReset().mockReturnValue(false);
  runner.skipPending.mockReset().mockResolvedValue(null);
  readAgentSession.mockReset().mockResolvedValue(SESSION);
  appendInteractionReply.mockClear();
  service = new AgentService();
  send = vi.fn(async () => sent);
  (service as unknown as { send: typeof send }).send = send;
});

describe('AgentService.sendFromUser', () => {
  it('sends the message as it is when no question waits', async () => {
    const input = { agentId: 'lwh/test', sessionId: 's-1', prompt: 'Make it blue' };
    expect(await service.sendFromUser(input)).toBe(sent);
    expect(runner.skipPending).toHaveBeenCalledWith(SESSION, 'Make it blue');
    expect(send).toHaveBeenCalledWith(input);
    expect(appendInteractionReply).not.toHaveBeenCalled();
  });

  it('answers a waiting question as skipped with the words typed, and records the skip', async () => {
    runner.skipPending.mockResolvedValue({
      requestId: 'q-1',
      message: '[Answer to question q-1] The user skipped the card and wrote: Go with a',
    });
    await service.sendFromUser({ agentId: 'lwh/test', sessionId: 's-1', prompt: 'Go with a', model: '' });
    expect(send).toHaveBeenCalledWith({
      agentId: 'lwh/test',
      sessionId: 's-1',
      prompt: '[Answer to question q-1] The user skipped the card and wrote: Go with a',
      model: '',
    });
    expect(appendInteractionReply).toHaveBeenCalledWith('lwh/test', 's-1', expect.objectContaining({ requestId: 'q-1', status: 'cancelled' }));
  });

  it('touches no question while a turn runs (that send is refused as already running)', async () => {
    runner.isRunning.mockReturnValue(true);
    const input = { agentId: 'lwh/test', sessionId: 's-1', prompt: 'hello' };
    await service.sendFromUser(input);
    expect(runner.skipPending).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(input);
  });
});
