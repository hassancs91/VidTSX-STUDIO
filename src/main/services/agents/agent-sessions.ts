// Saved agent sessions on disk (agents plan §1.5).
//
// Stage 1 built the runner against a session OBJECT and a
// `persistPendingInteraction` hook, deliberately leaving the writing to its
// caller. This is that caller's storage layer:
//
//   <userData>/agent-sessions/<namespace>.<name>/<sessionId>/
//       session.json   the record below
//       chat.json      { version: 1, messages }
//       artifacts.json owned by artifact-store.ts
//       work/...       documents, TSX, scratch (never media — §1.11)
//
// Folder-as-truth again, for the same reason the agent store uses it: an index
// file is one crash away from disagreeing with the folders it indexes. Listing
// is a directory walk, and a session whose `session.json` will not parse is
// rotated aside and skipped rather than taking the whole list down.
//
// `libraryFolder` is fixed at CREATE and stored, never recomputed. §1.11 says
// renaming a session must not move the media it already made, and a folder
// derived from the current title on every read would quietly do exactly that.

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  AgentArtifact,
  AgentChatMessage,
  AgentSession,
  AgentSessionSummary,
  InteractionRequest,
  StarterAnswers,
} from '../../../shared/types/agents';
import { agentDirName } from '../../../shared/agents/ids';
import { isInteractionRequest } from '../../../shared/agents/interactions';
import { getAgentSessionsDir, getAgentOutputFolder } from '../../utils/paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentSessions');

export const SESSION_FILE_NAME = 'session.json';
export const CHAT_FILE_NAME = 'chat.json';
const ARTIFACTS_FILE_NAME = 'artifacts.json';
const WORK_DIR_NAME = 'work';

/** Titles are shown in a list and used to name a library folder — cap them. */
const MAX_TITLE_CHARS = 120;

interface PersistedChat {
  version: 1;
  messages: AgentChatMessage[];
}

/** `<userData>/agent-sessions/<namespace>.<name>` — one folder per agent. */
export function agentSessionsRoot(agentId: string): string {
  return path.join(getAgentSessionsDir(), agentDirName(agentId));
}

export function agentSessionDir(agentId: string, sessionId: string): string {
  return path.join(agentSessionsRoot(agentId), sessionId);
}

/** The SDK `cwd` and the tools' workspace: work files only, never media. */
export function agentWorkspaceDir(agentId: string, sessionId: string): string {
  return path.join(agentSessionDir(agentId, sessionId), WORK_DIR_NAME);
}

/** Rotate, never delete (the store rule): a session the user spent an hour on
 *  must not vanish because one write was interrupted. */
async function rotateCorruptFile(file: string, reason: string): Promise<void> {
  const aside = file.replace(/\.json$/, `.corrupt.${Date.now()}.json`);
  await fs.rename(file, aside).catch(() => {});
  log.warn('Corrupt session file set aside', { aside, error: reason });
}

/**
 * Read one of a session's JSON files, rotating anything unusable aside.
 *
 * `isValid` matters as much as the parse does. A file that parses but carries
 * the wrong SHAPE used to fall straight through to the caller's default — and
 * for `chat.json` the caller's default is an empty transcript, which the next
 * `appendAgentChat` would then write back over the top of. Bad JSON was safe
 * and good JSON of the wrong shape silently destroyed the history; both are
 * corruption, so both rotate.
 */
async function readJsonFile(
  file: string,
  isValid?: (value: unknown) => boolean,
): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (err) {
    await rotateCorruptFile(file, err instanceof Error ? err.message : String(err));
    return null;
  }
  if (isValid && !isValid(parsed)) {
    await rotateCorruptFile(file, 'parsed but did not match the expected shape');
    return null;
  }
  return parsed;
}

/** Temp file then rename, so a crash leaves the previous version intact. */
async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmp, file);
}

function isSession(value: unknown): value is AgentSession {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<AgentSession>;
  return typeof s.id === 'string' && typeof s.agentId === 'string' && typeof s.title === 'string';
}

export function cleanTitle(title: string | undefined, fallback: string): string {
  const trimmed = (title ?? '').replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, MAX_TITLE_CHARS) : fallback;
}

export interface CreateAgentSessionInput {
  agentId: string;
  /** Display name from the manifest — half of the library folder (§1.11). */
  agentName: string;
  agentVersion: string;
  title?: string;
  providerId?: string;
  model?: string;
  starter?: StarterAnswers;
  /** Library default brand, so generated media is tagged like every other asset. */
  brandId?: string;
}

export async function createAgentSession(
  input: CreateAgentSessionInput,
): Promise<AgentSession> {
  const id = `s-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const title = cleanTitle(input.title, 'New session');
  const session: AgentSession = {
    id,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    title,
    createdAt: now,
    lastOpenedAt: now,
    libraryFolder: getAgentOutputFolder(input.agentName, title),
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.starter ? { starter: input.starter } : {}),
    ...(input.brandId ? { brandId: input.brandId } : {}),
  };
  await fs.mkdir(agentWorkspaceDir(input.agentId, id), { recursive: true });
  await writeAgentSession(session);
  log.info('Created agent session', { agentId: input.agentId, sessionId: id });
  return session;
}

export async function writeAgentSession(session: AgentSession): Promise<void> {
  await writeJsonFile(
    path.join(agentSessionDir(session.agentId, session.id), SESSION_FILE_NAME),
    session,
  );
}

export async function readAgentSession(
  agentId: string,
  sessionId: string,
): Promise<AgentSession | null> {
  const raw = await readJsonFile(
    path.join(agentSessionDir(agentId, sessionId), SESSION_FILE_NAME),
    isSession,
  );
  if (!isSession(raw)) return null;
  // A pending question is the one field in here that a CARD renders directly,
  // and the only one the tool-boundary zod never saw (it was written before the
  // app closed, and the file may have been hand-edited since). A malformed one
  // is dropped rather than handed to the registry — the user loses a question
  // they can no longer answer, which is better than a stage that throws.
  if (raw.pendingInteraction !== undefined && !isInteractionRequest(raw.pendingInteraction)) {
    log.warn('Dropping a malformed pending question', { agentId, sessionId });
    return { ...raw, pendingInteraction: undefined };
  }
  return raw;
}

/** Read-modify-write one session. Returns null when it is gone. */
export async function patchAgentSession(
  agentId: string,
  sessionId: string,
  patch: Partial<AgentSession>,
): Promise<AgentSession | null> {
  const session = await readAgentSession(agentId, sessionId);
  if (!session) return null;
  const next = { ...session, ...patch };
  // `undefined` in a patch means "clear it" — JSON.stringify drops the key,
  // which is exactly what clearing a pending question needs.
  await writeAgentSession(next);
  return next;
}

/** The runner's `persistPendingInteraction` hook (§1.5, non-blocking form). */
export async function setPendingInteraction(
  agentId: string,
  sessionId: string,
  request: InteractionRequest | null,
): Promise<void> {
  await patchAgentSession(agentId, sessionId, {
    ...(request ? { pendingInteraction: request } : { pendingInteraction: undefined }),
  });
}

async function readArtifacts(sessionDir: string): Promise<AgentArtifact[]> {
  const raw = await readJsonFile(path.join(sessionDir, ARTIFACTS_FILE_NAME));
  if (typeof raw !== 'object' || raw === null) return [];
  const artifacts = (raw as { artifacts?: unknown }).artifacts;
  return Array.isArray(artifacts) ? (artifacts as AgentArtifact[]) : [];
}

/** The newest visual artifact's library path — the sessions list thumbnail. */
function thumbnailFrom(artifacts: AgentArtifact[]): string | undefined {
  for (let i = artifacts.length - 1; i >= 0; i -= 1) {
    const artifact = artifacts[i];
    if (artifact.kind === 'image-set' && artifact.payload.items.length > 0) {
      return artifact.payload.items[0].relPath;
    }
  }
  return undefined;
}

/** Every saved session for one agent, most recently opened first. */
export async function listAgentSessions(agentId: string): Promise<AgentSessionSummary[]> {
  const root = agentSessionsRoot(agentId);
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // The agent has never been run — an empty list, not a failure.
  }

  const sessions: AgentSessionSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    const raw = await readJsonFile(path.join(dir, SESSION_FILE_NAME), isSession);
    if (!isSession(raw)) continue;
    const artifacts = await readArtifacts(dir);
    const thumbnail = raw.thumbnailRelPath ?? thumbnailFrom(artifacts);
    sessions.push({
      ...raw,
      artifactCount: artifacts.length,
      ...(thumbnail ? { thumbnailRelPath: thumbnail } : {}),
    });
  }
  return sessions.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

/**
 * Delete the session FOLDER only (§1.5). Media already filed in the library
 * stays: the user may have used it somewhere else, and a chat transcript is
 * not a good enough reason to delete a video they paid for.
 */
export async function deleteAgentSession(agentId: string, sessionId: string): Promise<void> {
  await fs.rm(agentSessionDir(agentId, sessionId), { recursive: true, force: true });
  log.info('Deleted agent session', { agentId, sessionId });
}

function isPersistedChat(value: unknown): value is PersistedChat {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Partial<PersistedChat>).messages)
  );
}

export async function readAgentChat(
  agentId: string,
  sessionId: string,
): Promise<AgentChatMessage[]> {
  const raw = await readJsonFile(
    path.join(agentSessionDir(agentId, sessionId), CHAT_FILE_NAME),
    isPersistedChat,
  );
  return isPersistedChat(raw) ? raw.messages : [];
}

export async function writeAgentChat(
  agentId: string,
  sessionId: string,
  messages: AgentChatMessage[],
): Promise<void> {
  const chat: PersistedChat = { version: 1, messages };
  await writeJsonFile(path.join(agentSessionDir(agentId, sessionId), CHAT_FILE_NAME), chat);
}

/** Append one turn's messages, so a run never rewrites what it did not touch. */
export async function appendAgentChat(
  agentId: string,
  sessionId: string,
  added: AgentChatMessage[],
): Promise<void> {
  if (added.length === 0) return;
  const existing = await readAgentChat(agentId, sessionId);
  await writeAgentChat(agentId, sessionId, [...existing, ...added]);
}
