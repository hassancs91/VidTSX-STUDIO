// Zip WRITE side for `.vidtsx` packages (Q7a). One thin class over archiver so
// the writer above it stays about project semantics instead of stream plumbing.
//
// Two properties the format depends on and this file provides:
//   1. **Every entry is hashed as it is written** — a tap transform between the
//      file and the archive, so multi-GB media is read once, not twice (the
//      manifest's per-file sha256 is the import-side integrity check).
//   2. **Appends are serialized** — each `add*` resolves on archiver's `entry`
//      event before the next begins, which bounds memory to one entry and makes
//      progress reporting honest instead of a guess.
//
// Media is STORED, never deflated: mp4/jpg are already compressed, so deflate
// burns minutes of CPU for ~0%. JSON and TSX deflate well and are tiny either
// way, so they take the default level.

import archiver from 'archiver';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Transform } from 'stream';
import type { PackageFileEntry } from '../../../shared/studio/project-package';

interface PendingEntry {
  name: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class PackageZipWriter {
  private readonly archive: archiver.Archiver;
  private readonly closed: Promise<void>;
  private pending: PendingEntry | null = null;
  private failure: Error | null = null;
  private readonly written: PackageFileEntry[] = [];

  constructor(destPath: string) {
    const output = createWriteStream(destPath);
    this.archive = archiver('zip', { zlib: { level: 6 } });

    this.closed = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      this.archive.on('error', (err) => {
        this.fail(err);
        reject(err);
      });
    });

    // Serializes appends: `add*` waits for the entry it just queued.
    this.archive.on('entry', (entry) => {
      const pending = this.pending;
      if (pending && entry.name === pending.name) {
        this.pending = null;
        pending.resolve();
      }
    });

    // A stream failure (destination unwritable, disk full) must surface at the
    // `add*` call that is waiting, not as an unhandled rejection later. This
    // also marks `closed` as handled — `finish()` still re-throws it.
    void this.closed.catch((err: Error) => this.fail(err));

    this.archive.pipe(output);
  }

  /** Entries written so far — becomes the manifest's `files` list. */
  get entries(): readonly PackageFileEntry[] {
    return this.written;
  }

  get bytes(): number {
    return this.written.reduce((sum, entry) => sum + entry.size, 0);
  }

  private fail(err: Error): void {
    this.failure ??= err;
    const pending = this.pending;
    if (pending) {
      this.pending = null;
      pending.reject(err);
    }
  }

  private waitForEntry(name: string): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise<void>((resolve, reject) => {
      this.pending = { name, resolve, reject };
    });
  }

  private record(entry: PackageFileEntry): void {
    this.written.push(entry);
  }

  /** Add an in-memory entry (manifest, rewritten project.json, small files). */
  async addBuffer(name: string, data: Buffer): Promise<PackageFileEntry> {
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const done = this.waitForEntry(name);
    this.archive.append(data, { name });
    await done;
    const entry: PackageFileEntry = { path: name, size: data.length, sha256 };
    this.record(entry);
    return entry;
  }

  async addJson(name: string, value: unknown): Promise<PackageFileEntry> {
    return this.addBuffer(name, Buffer.from(JSON.stringify(value, null, 2), 'utf-8'));
  }

  /**
   * Add a file from disk. `store: true` skips deflate (media). The hash is
   * computed from the bytes actually streamed, so it can never disagree with
   * what landed in the archive.
   */
  async addFile(name: string, diskPath: string, store = false): Promise<PackageFileEntry> {
    const stat = await fs.stat(diskPath);
    const hash = crypto.createHash('sha256');
    const tap = new Transform({
      transform(chunk: Buffer, _enc, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    const source = createReadStream(diskPath);
    source.on('error', (err) => {
      this.fail(err);
      tap.destroy(err);
    });

    const done = this.waitForEntry(name);
    this.archive.append(source.pipe(tap), { name, store });
    await done;

    const entry: PackageFileEntry = { path: name, size: stat.size, sha256: hash.digest('hex') };
    this.record(entry);
    return entry;
  }

  /** Copy a whole folder in, one entry per file, under `prefix/`. Returns the
   *  entries so the caller can fold them into the manifest. */
  async addDirectory(
    prefix: string,
    dir: string,
    filter?: (relPath: string) => boolean,
  ): Promise<PackageFileEntry[]> {
    const added: PackageFileEntry[] = [];
    const walk = async (current: string, rel: string): Promise<void> => {
      const dirEntries = await fs.readdir(current, { withFileTypes: true });
      for (const dirEntry of dirEntries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (dirEntry.name.startsWith('.')) continue;
        const relPath = rel === '' ? dirEntry.name : `${rel}/${dirEntry.name}`;
        const abs = `${current}/${dirEntry.name}`;
        if (dirEntry.isDirectory()) {
          await walk(abs, relPath);
        } else if (dirEntry.isFile() && (!filter || filter(relPath))) {
          added.push(await this.addFile(`${prefix}/${relPath}`, abs));
        }
      }
    };
    await walk(dir, '');
    return added;
  }

  /** Flush and close. Resolves once the .vidtsx file is fully on disk. */
  async finish(): Promise<void> {
    if (this.failure) throw this.failure;
    await this.archive.finalize();
    await this.closed;
  }

  /** Abandon the archive after a failure — the caller unlinks the partial file. */
  abort(): void {
    this.archive.abort();
  }
}
