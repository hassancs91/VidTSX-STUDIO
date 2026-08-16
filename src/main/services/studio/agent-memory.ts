// Agent memory store — userData/studio/memory.json, atomic tmp+rename
// (project-store precedent). Deliberately NOT the assets root: that root
// holds relocatable content (logos, footage); memory is app behaviour
// (design doc M7).
//
// The store enforces the two shape rules the UI relies on:
// - MAX_ACTIVE_RULES: activating a rule past the cap throws — accepting a
//   new rule at the cap requires deactivating another (M5).
// - Profile is a singleton (QM1): saving a new profile entry while one
//   exists replaces the existing entry's text instead of adding a second.

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import {
  MAX_ACTIVE_RULES,
  MAX_MEMORY_ALIASES,
  MEMORY_TEXT_LIMITS,
  type StudioMemory,
  type StudioMemoryKind,
  type StudioMemorySource,
} from '../../../shared/types/studio-memory';

const log = logEngine.createLogger('AgentMemory');

const SCHEMA_VERSION = 1;

/** Backfill for hand-edited records missing timestamps. A FIXED string, not
 *  new Date() — a fresh timestamp per load would reorder the composed block
 *  between reads and silently invalidate the prompt cache. */
const EPOCH = '1970-01-01T00:00:00.000Z';

/** All mutations are serialized through this queue — the store is
 *  read-modify-write, and two interleaved saves (agent proposal accepted
 *  while the dialog edits) would drop the loser's record. */
let mutationQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(op, op);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Rules and vocabulary are single list lines in the prompt block — collapse
 *  internal whitespace so a newline can't escape the list or fake a section
 *  header. Profile keeps its paragraphs. */
function normalizeText(kind: StudioMemoryKind, text: string): string {
  if (kind === 'profile') {
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeAliases(aliases: string[] | undefined): string[] {
  return (aliases ?? [])
    .map((a) => a.replace(/\s+/g, ' ').trim())
    .filter((a) => a.length > 0)
    .slice(0, MAX_MEMORY_ALIASES)
    .map((a) => a.slice(0, MEMORY_TEXT_LIMITS.vocabulary));
}

interface MemoryFile {
  schemaVersion: number;
  memories: StudioMemory[];
}

export interface UpsertMemoryInput {
  /** Present = update that record; absent = create. */
  id?: string;
  kind: StudioMemoryKind;
  text: string;
  aliases?: string[];
  brandId?: string;
  source: StudioMemorySource;
}

function getMemoryFilePath(): string {
  return path.join(app.getPath('userData'), 'studio', 'memory.json');
}

function isValidKind(kind: unknown): kind is StudioMemoryKind {
  return kind === 'rule' || kind === 'vocabulary' || kind === 'profile';
}

/** Keep only records the rest of the app can trust; drop the rest quietly.
 *  Hand-edited files get the same normalization the write path applies. */
function normalizeRecord(raw: unknown): StudioMemory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Partial<StudioMemory>;
  if (typeof doc.id !== 'string' || doc.id.length === 0) return null;
  if (!isValidKind(doc.kind)) return null;
  if (typeof doc.text !== 'string') return null;
  const text = normalizeText(doc.kind, doc.text).slice(0, MEMORY_TEXT_LIMITS[doc.kind]);
  if (text.length === 0) return null;
  const source: StudioMemorySource =
    doc.source && doc.source.by === 'agent' && typeof doc.source.projectId === 'string'
      ? { by: 'agent', projectId: doc.source.projectId, acceptedAt: String(doc.source.acceptedAt ?? '') }
      : { by: 'user' };
  const aliases = normalizeAliases(
    Array.isArray(doc.aliases) ? doc.aliases.filter((a): a is string => typeof a === 'string') : undefined,
  );
  return {
    id: doc.id,
    kind: doc.kind,
    text,
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(typeof doc.brandId === 'string' && doc.brandId ? { brandId: doc.brandId } : {}),
    active: doc.active !== false,
    source,
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : EPOCH,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : EPOCH,
  };
}

async function readFileOrEmpty(): Promise<StudioMemory[]> {
  const filePath = getMemoryFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return []; // Not created yet.
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MemoryFile>;
    if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.memories)) {
      throw new Error(`Unsupported memory file shape (schemaVersion ${String(parsed.schemaVersion)})`);
    }
    return parsed.memories
      .map(normalizeRecord)
      .filter((m): m is StudioMemory => m !== null);
  } catch (err) {
    // A corrupt file must not eat the user's memories on the next save —
    // set it aside and start empty.
    const backupPath = `${filePath}.corrupt`;
    log.error('memory.json unreadable — moving aside and starting empty', {
      backupPath,
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      await fs.rename(filePath, backupPath);
    } catch {
      // Rename failure means the next save overwrites; already logged above.
    }
    return [];
  }
}

/** Atomic write: temp file in the same folder, then rename over memory.json. */
async function writeFileAtomic(memories: StudioMemory[]): Promise<void> {
  const filePath = getMemoryFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const doc: MemoryFile = { schemaVersion: SCHEMA_VERSION, memories };
  await fs.writeFile(tmpPath, JSON.stringify(doc, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

function assertRuleCap(memories: StudioMemory[], excludeId?: string): void {
  const activeRules = memories.filter(
    (m) => m.kind === 'rule' && m.active && m.id !== excludeId,
  ).length;
  if (activeRules >= MAX_ACTIVE_RULES) {
    throw new Error(
      `You already have ${MAX_ACTIVE_RULES} active rules (the cap). Deactivate one to make room.`,
    );
  }
}

export async function listMemories(): Promise<StudioMemory[]> {
  return readFileOrEmpty();
}

export async function upsertMemory(input: UpsertMemoryInput): Promise<StudioMemory> {
  return enqueue(async () => {
    const text = normalizeText(input.kind, input.text);
    if (!text) throw new Error('A memory needs text.');
    const limit = MEMORY_TEXT_LIMITS[input.kind];
    if (text.length > limit) {
      throw new Error(`A ${input.kind} memory is limited to ${limit} characters (this one is ${text.length}).`);
    }
    const memories = await readFileOrEmpty();
    const now = new Date().toISOString();

    // Profile is a singleton — a "new" profile entry edits the existing one.
    const targetId =
      input.id ??
      (input.kind === 'profile' ? memories.find((m) => m.kind === 'profile')?.id : undefined);

    const existing = targetId ? memories.find((m) => m.id === targetId) : undefined;
    if (targetId && input.id && !existing) {
      throw new Error(`Unknown memory id: ${targetId}`);
    }

    const aliases = normalizeAliases(input.aliases);
    const record: StudioMemory = {
      id: existing?.id ?? randomUUID(),
      kind: input.kind,
      text,
      ...(aliases.length > 0 ? { aliases } : {}),
      ...(input.brandId ? { brandId: input.brandId } : {}),
      active: existing?.active ?? true,
      source: existing?.source ?? input.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (record.kind === 'rule' && record.active) {
      assertRuleCap(memories, record.id);
    }

    const next = existing
      ? memories.map((m) => (m.id === record.id ? record : m))
      : [...memories, record];
    await writeFileAtomic(next);
    return record;
  });
}

export async function setMemoryActive(id: string, active: boolean): Promise<StudioMemory> {
  return enqueue(async () => {
    const memories = await readFileOrEmpty();
    const existing = memories.find((m) => m.id === id);
    if (!existing) throw new Error(`Unknown memory id: ${id}`);
    if (existing.active === active) return existing;
    if (active && existing.kind === 'rule') {
      assertRuleCap(memories, id);
    }
    const record: StudioMemory = { ...existing, active, updatedAt: new Date().toISOString() };
    await writeFileAtomic(memories.map((m) => (m.id === id ? record : m)));
    return record;
  });
}

export async function deleteMemory(id: string): Promise<void> {
  return enqueue(async () => {
    const memories = await readFileOrEmpty();
    if (!memories.some((m) => m.id === id)) return; // Already gone — idempotent.
    await writeFileAtomic(memories.filter((m) => m.id !== id));
  });
}
