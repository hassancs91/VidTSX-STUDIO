/**
 * Main's writer for project.json (B5 fix round 1, the verifier's FAIL: closing
 * the editor while another program held project.json lost the edit).
 *
 * The renderer's autosave owns the document while the editor is open; its
 * saves come through `save`. When the editor closes, or the window quits,
 * with changes not yet on disk, the renderer hands the document over
 * (`handOff`, one IPC call) and THIS module owns the write from then on: it
 * retries in the background with backoff for minutes (bounded, logged),
 * independent of the editor's lifecycle. On quit, shutdown `drain`s it for a
 * bounded time; whatever is still held stays in `project.json.tmp`, which
 * the next open recovers (`load` → project-recovery.ts).
 *
 * Every write of one project runs one at a time, in arrival order — a save
 * from a reopened editor is newer than any hand-off, so it supersedes it.
 */

import { logEngine } from '../../../logging/log-engine';
import type { StudioProject } from '../../../shared/types/studio';
import { nodeProjectFs, writeProjectFileWith, type ProjectFs } from './project-file';
import { recoverProjectTmp } from './project-recovery';
import { migrateProject } from './project-store';
import { getProjectDir, getProjectFilePath } from './studio-paths';

export { nodeProjectFs, type ProjectFs } from './project-file';

export interface ProjectWriterLog {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ProjectWriterOptions {
  fs?: ProjectFs;
  projectDir?: (id: string) => Promise<string>;
  log?: ProjectWriterLog;
  /** Waits between background tries of a hand-off; the last value repeats. */
  retryDelaysMs?: number[];
  /** A hand-off stops retrying this long after it arrived (the .tmp stays). */
  giveUpAfterMs?: number;
}

export interface ProjectLoadResult {
  project: StudioProject;
  /** The document came from a hand-off or a `.tmp` — tell the user once. */
  recovered?: true;
  /** The document is not on disk yet — the editor must save it. */
  unsaved?: true;
}

export interface ProjectWriter {
  /** The open editor's save; resolves with the stamped `updatedAt`. */
  save(project: StudioProject): Promise<string>;
  /** Take over an unsaved document from a closing editor. Returns at once. */
  handOff(project: StudioProject): void;
  /** Open a project: a pending hand-off or a newer `.tmp` wins over project.json. */
  load(id: string): Promise<ProjectLoadResult>;
  /** Quit: retry pending hand-offs now, for at most `timeoutMs`; returns the
   *  ids still unwritten (their `.tmp` is recovered on the next open). */
  drain(timeoutMs: number): Promise<string[]>;
  pendingIds(): string[];
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 3000, 5000, 10_000, 15_000, 30_000];
const DEFAULT_GIVE_UP_AFTER_MS = 10 * 60_000;
/** On quit, how long a write already running may take to finish its `.tmp`. */
const DRAIN_SETTLE_MS = 2000;

interface PendingWrite {
  project: StudioProject;
  since: number;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createProjectWriter(options: ProjectWriterOptions = {}): ProjectWriter {
  const pfs = options.fs ?? nodeProjectFs;
  const projectDir = options.projectDir ?? getProjectDir;
  const log = options.log ?? logEngine.createLogger('StudioProjectWriter');
  const delays = options.retryDelaysMs?.length ? options.retryDelaysMs : DEFAULT_RETRY_DELAYS_MS;
  const giveUpAfterMs = options.giveUpAfterMs ?? DEFAULT_GIVE_UP_AFTER_MS;

  const pending = new Map<string, PendingWrite>();
  const chains = new Map<string, Promise<void>>();
  let stopping = false;

  /** One write at a time per project, in arrival order. */
  function serialize<T>(id: string, job: () => Promise<T>): Promise<T> {
    const run = (chains.get(id) ?? Promise.resolve()).then(job);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    chains.set(id, tail);
    void tail.then(() => {
      if (chains.get(id) === tail) chains.delete(id);
    });
    return run;
  }

  /** Resolves when no write is running, or after `ms` — whichever is first. */
  async function settle(ms: number): Promise<void> {
    if (chains.size === 0 || ms <= 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      Promise.all([...chains.values()]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
    if (timer) clearTimeout(timer);
  }

  function take(id: string): PendingWrite | null {
    const entry = pending.get(id) ?? null;
    if (entry?.timer) clearTimeout(entry.timer);
    pending.delete(id);
    return entry;
  }

  async function write(project: StudioProject): Promise<void> {
    await writeProjectFileWith(pfs, await projectDir(project.id), project);
  }

  function attempt(id: string, entry: PendingWrite): Promise<void> {
    return serialize(id, async () => {
      if (pending.get(id) !== entry) return; // landed, superseded or taken back
      entry.timer = null;
      entry.attempts += 1;
      try {
        await write(entry.project);
        pending.delete(id);
        log.info('Handed-off project save landed', { id, attempts: entry.attempts, afterMs: Date.now() - entry.since });
      } catch (err) {
        if (pending.get(id) !== entry) return;
        const elapsed = Date.now() - entry.since;
        const gone = (err as NodeJS.ErrnoException).code === 'ENOENT'; // the project folder itself
        if (gone || elapsed >= giveUpAfterMs) {
          pending.delete(id);
          log.error('Gave up on a handed-off project save — project.json.tmp is kept for recovery on the next open', {
            id,
            attempts: entry.attempts,
            afterMs: elapsed,
            error: errorText(err),
          });
          return;
        }
        if (entry.attempts === 1) {
          log.warn('Handed-off project save refused — retrying in the background', { id, error: errorText(err) });
        }
        if (stopping) return;
        const wait = delays[Math.min(entry.attempts - 1, delays.length - 1)];
        entry.timer = setTimeout(() => void attempt(id, entry), Math.min(wait, giveUpAfterMs - elapsed));
      }
    });
  }

  return {
    save(project) {
      // An editor saving this project owns it again: a waiting hand-off is older.
      take(project.id);
      return serialize(project.id, async () => {
        const updatedAt = new Date().toISOString();
        await write({ ...project, updatedAt });
        return updatedAt;
      });
    },

    handOff(project) {
      take(project.id);
      const entry: PendingWrite = {
        project: { ...project, updatedAt: new Date().toISOString() },
        since: Date.now(),
        attempts: 0,
        timer: null,
      };
      pending.set(project.id, entry);
      void attempt(project.id, entry);
    },

    async load(id) {
      const dir = await projectDir(id);
      return serialize(id, async (): Promise<ProjectLoadResult> => {
        const handed = take(id);
        if (handed) {
          log.info('Reopened a project whose save was still pending — the editor owns it again', { id });
          return { project: handed.project, recovered: true, unsaved: true };
        }
        const found = await recoverProjectTmp(pfs, dir, id, log);
        if (found.kind === 'loaded') return { project: found.project, recovered: true, unsaved: true };
        const project = migrateProject(JSON.parse(await pfs.readFile(getProjectFilePath(dir))), id);
        return found.kind === 'finalized' ? { project, recovered: true } : { project };
      });
    },

    async drain(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (pending.size > 0 && Date.now() < deadline) {
        for (const [id, entry] of pending) {
          if (!entry.timer) continue; // its try is running now
          clearTimeout(entry.timer);
          entry.timer = null;
          void attempt(id, entry);
        }
        await settle(deadline - Date.now());
        if (pending.size > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, Math.min(250, deadline - Date.now()))));
        }
      }
      stopping = true;
      for (const entry of pending.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
      }
      await settle(DRAIN_SETTLE_MS);
      const left = [...pending.keys()];
      for (const id of left) {
        log.warn('Quit while a project save was still refused — project.json.tmp is recovered on the next open', { id });
      }
      return left;
    },

    pendingIds: () => [...pending.keys()],
  };
}

/** The app's one writer. */
export const projectWriter = createProjectWriter();
