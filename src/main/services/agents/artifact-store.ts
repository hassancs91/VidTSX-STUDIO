// `artifacts.json` for one agent session (agents plan §1.5, §4).
//
// The ONE write path. Tools return drafts; the runner calls `add`, and this
// file is what assigns the id, `createdAt`, the producer and the version. Ids
// are `<kind>-<n>` over a single per-session sequence, because the model reads
// them back out of tool results and "composition-2" is easier to keep straight
// than a UUID.
//
// A corrupt file is rotated aside, never deleted (the memory/chat-store rule):
// losing a session's result list is bad, losing it silently is worse.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact, AgentArtifactDraft } from '../../../shared/types/agents';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentArtifacts');

export const ARTIFACTS_FILE_NAME = 'artifacts.json';

interface PersistedArtifacts {
  version: 1;
  updatedAt: string;
  artifacts: AgentArtifact[];
}

export interface AddArtifactOptions {
  /** Artifact this one is a new version of; its version + 1 is carried over. */
  supersedes?: string;
}

/**
 * Reject anything that is not a plain relative path inside its root: absolute
 * POSIX or Windows paths, drive letters, UNC prefixes and any `..` segment.
 * Artifact paths are always built by a tool from ids the app controls, so a
 * failure here means a bug, not a user mistake.
 */
export function assertContainedRelPath(relPath: string, what: string): void {
  if (!relPath || relPath.trim() !== relPath) {
    throw new Error(`${what} must be a non-empty relative path`);
  }
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath) || relPath.startsWith('\\\\')) {
    throw new Error(`${what} must be relative, got "${relPath}"`);
  }
  const segments = relPath.replace(/\\/g, '/').split('/');
  if (segments.some((s) => s === '..' || s === '')) {
    throw new Error(`${what} must not contain empty or ".." segments, got "${relPath}"`);
  }
}

function assertDraftPaths(draft: AgentArtifactDraft): void {
  switch (draft.kind) {
    case 'document':
    case 'composition':
    case 'video':
      assertContainedRelPath(draft.payload.relPath, `${draft.kind} relPath`);
      return;
    case 'image-set':
      for (const item of draft.payload.items) {
        assertContainedRelPath(item.relPath, 'image-set relPath');
      }
      return;
    case 'job':
      return;
  }
}

export class AgentArtifactStore {
  private artifacts: AgentArtifact[] = [];
  private seq = 0;
  private writing: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string) {}

  /** Load (or start) the store for a session folder. */
  static async open(sessionDir: string): Promise<AgentArtifactStore> {
    const store = new AgentArtifactStore(path.join(sessionDir, ARTIFACTS_FILE_NAME));
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf-8');
    } catch {
      return; // No artifacts yet.
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedArtifacts>;
      if (!Array.isArray(parsed.artifacts)) throw new Error('missing artifacts array');
      this.artifacts = parsed.artifacts;
      this.seq = this.artifacts.reduce((max, a) => {
        const n = Number(a.id.slice(a.id.lastIndexOf('-') + 1));
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
    } catch (err) {
      const asidePath = this.filePath.replace(/\.json$/, `.corrupt.${Date.now()}.json`);
      await fs.rename(this.filePath, asidePath).catch(() => {});
      log.warn('Corrupt artifacts.json set aside', {
        asidePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** A copy — nothing outside this class may mutate the list. */
  list(): AgentArtifact[] {
    return this.artifacts.map((a) => structuredClone(a));
  }

  get(id: string): AgentArtifact | undefined {
    const found = this.artifacts.find((a) => a.id === id);
    return found ? structuredClone(found) : undefined;
  }

  async add(
    draft: AgentArtifactDraft,
    producer: { tool: string; callId: string },
    options: AddArtifactOptions = {},
  ): Promise<AgentArtifact> {
    assertDraftPaths(draft);
    this.seq += 1;
    const previous = options.supersedes
      ? this.artifacts.find((a) => a.id === options.supersedes)
      : undefined;
    if (options.supersedes && !previous) {
      throw new Error(`Cannot supersede unknown artifact "${options.supersedes}"`);
    }
    const artifact = {
      id: `${draft.kind}-${this.seq}`,
      kind: draft.kind,
      title: draft.title,
      createdAt: new Date().toISOString(),
      producer,
      version: (previous?.version ?? 0) + 1,
      payload: draft.payload,
    } as AgentArtifact;
    this.artifacts.push(artifact);
    await this.persist();
    return structuredClone(artifact);
  }

  /**
   * Merge fields into an artifact's payload — how a `job` artifact reaches its
   * terminal state and gains its `resultArtifactId`.
   */
  async patchPayload(id: string, patch: Record<string, unknown>): Promise<AgentArtifact> {
    const index = this.artifacts.findIndex((a) => a.id === id);
    if (index === -1) throw new Error(`Unknown artifact "${id}"`);
    const current = this.artifacts[index];
    const next = {
      ...current,
      payload: { ...(current.payload as Record<string, unknown>), ...patch },
    } as AgentArtifact;
    this.artifacts[index] = next;
    await this.persist();
    return structuredClone(next);
  }

  async bumpVersion(id: string): Promise<AgentArtifact> {
    const index = this.artifacts.findIndex((a) => a.id === id);
    if (index === -1) throw new Error(`Unknown artifact "${id}"`);
    const next = { ...this.artifacts[index], version: (this.artifacts[index].version ?? 1) + 1 };
    this.artifacts[index] = next as AgentArtifact;
    await this.persist();
    return structuredClone(this.artifacts[index]);
  }

  /** Writes are serialized and atomic: temp file, then rename. */
  private persist(): Promise<void> {
    const snapshot: PersistedArtifacts = {
      version: 1,
      updatedAt: new Date().toISOString(),
      artifacts: this.artifacts,
    };
    this.writing = this.writing.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
      await fs.rename(tmp, this.filePath);
    });
    return this.writing;
  }
}
