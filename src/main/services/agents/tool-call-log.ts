// The per-session record of tool CALLS with their arguments, and of the
// user's replies to the questions those calls asked (W8 Stage 5, flows plan
// §1.5 "Freeze").
//
//   <session>/calls.json   { version: 1, calls: ToolCallRecord[], replies: InteractionReplyRecord[] }
//
// Why it exists: an artifact carries `producer.callId` (agents plan §1.4), but
// until this stage nothing kept the call itself — the tool server emitted
// `{ tool, callId }` and dropped the arguments. The lineage walk that freezes
// a session into a flow needs "which artifacts did this call take, and what
// literal values did it use", so every completed call is appended here by the
// tool server (through the runner's hook), and every interaction reply by
// the service. Sessions recorded before this file existed freeze with a typed
// "no lineage" error rather than a guess.
//
// The file is appended through one in-memory copy per session and a serial
// write queue, so two independent calls of one turn cannot clobber each
// other and a read right after a write sees the write.

import fs from 'fs/promises';
import path from 'path';
import { agentSessionDir } from './agent-sessions';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentCallLog');

export const CALLS_FILE_NAME = 'calls.json';

/** Strings above this are cut (a base64 image is never useful to a freeze). */
const MAX_STRING_CHARS = 200_000;

export interface ToolCallRecord {
  callId: string;
  tool: string;
  /** ISO time the call completed. */
  at: string;
  /** The validated arguments, long strings truncated. */
  args: Record<string, unknown>;
  isError?: boolean;
  /** Artifacts this call filed, in filing order. */
  artifactIds: string[];
  /** `ask_user`: the interaction requests this call posted. */
  requestIds?: string[];
}

export interface InteractionReplyRecord {
  requestId: string;
  at: string;
  status: 'answered' | 'cancelled' | 'expired';
  values?: Record<string, string[]>;
}

export interface ToolCallLog {
  version: 1;
  calls: ToolCallRecord[];
  replies: InteractionReplyRecord[];
}

const EMPTY: ToolCallLog = { version: 1, calls: [], replies: [] };

const cache = new Map<string, ToolCallLog>();
const queues = new Map<string, Promise<void>>();

function logFile(agentId: string, sessionId: string): string {
  return path.join(agentSessionDir(agentId, sessionId), CALLS_FILE_NAME);
}

function isLog(value: unknown): value is ToolCallLog {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolCallLog>;
  return Array.isArray(v.calls) && Array.isArray(v.replies);
}

/** A copy of the arguments with every long string cut — what the file holds. */
export function sanitizeCallArgs(args: unknown): Record<string, unknown> {
  const cut = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.length > MAX_STRING_CHARS ? `${value.slice(0, MAX_STRING_CHARS)}… [truncated]` : value;
    }
    if (Array.isArray(value)) return value.map(cut);
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cut(v);
      return out;
    }
    return value;
  };
  const result = cut(args ?? {});
  return typeof result === 'object' && result !== null && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {};
}

async function load(file: string): Promise<ToolCallLog> {
  const cached = cache.get(file);
  if (cached) return cached;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf-8')) as unknown;
  } catch {
    // Missing or unreadable: an empty log. A corrupt file is not rotated —
    // it is a lineage aid, and the next append rewrites it whole.
  }
  const value: ToolCallLog = isLog(parsed) ? parsed : structuredClone(EMPTY);
  cache.set(file, value);
  return value;
}

function enqueue(file: string, work: () => Promise<void>): Promise<void> {
  const next = (queues.get(file) ?? Promise.resolve()).then(work, work);
  queues.set(file, next);
  return next;
}

async function persist(file: string, value: ToolCallLog): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmp, file);
}

export function appendToolCall(agentId: string, sessionId: string, record: ToolCallRecord): Promise<void> {
  const file = logFile(agentId, sessionId);
  return enqueue(file, async () => {
    const value = await load(file);
    value.calls.push({ ...record, args: sanitizeCallArgs(record.args) });
    await persist(file, value);
  }).catch((err) => {
    log.warn('Could not record a tool call', { sessionId, tool: record.tool, error: err instanceof Error ? err.message : String(err) });
  });
}

export function appendInteractionReply(agentId: string, sessionId: string, record: InteractionReplyRecord): Promise<void> {
  const file = logFile(agentId, sessionId);
  return enqueue(file, async () => {
    const value = await load(file);
    value.replies.push(record);
    await persist(file, value);
  }).catch((err) => {
    log.warn('Could not record an interaction reply', { sessionId, error: err instanceof Error ? err.message : String(err) });
  });
}

/** The whole log, after any pending append has landed. A copy. */
export async function readToolCallLog(agentId: string, sessionId: string): Promise<ToolCallLog> {
  const file = logFile(agentId, sessionId);
  await (queues.get(file) ?? Promise.resolve()).catch(() => {});
  return structuredClone(await load(file));
}

/** Test seam: forget the in-memory copies (the files stay). */
export function clearToolCallLogCacheForTests(): void {
  cache.clear();
  queues.clear();
}
