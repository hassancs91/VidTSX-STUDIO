// Zip READ side for `.vidtsx` packages — the security boundary (Q7e).
//
// A package is untrusted input (the template marketplace is the whole point of
// the format), so this file is written as a gate, not a convenience:
//
//   1. **The manifest is the allowlist.** Entries the manifest does not list
//      are ignored, whatever the central directory says. A package cannot
//      smuggle a file past the reader by simply putting it in the zip.
//   2. **Zip-slip is checked twice.** `isSafeEntryPath` runs on the name
//      (string-only, before any resolve, inside the manifest validator), and
//      every extraction target is then resolved and asserted to live inside
//      the extraction root — the `safeResolveCachePath` discipline applied at
//      the package boundary.
//   3. **Declared size == actual size.** Every manifest entry is matched
//      against the zip's own uncompressed size before a byte is written, so a
//      capped manifest cannot front for a zip bomb.
//   4. **Every extracted file is hashed as it lands.** A mismatch unlinks the
//      file and fails the import — a corrupt or tampered package never becomes
//      a project.

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import type { File as ZipFile } from 'unzipper';
import {
  PACKAGE_LIMITS,
  PACKAGE_MANIFEST_NAME,
  type VidtsxManifest,
} from '../../../shared/studio/project-package';
import { parsePackageManifest } from '../../../shared/studio/project-package-manifest';

/** Thrown for every "this package is not acceptable" outcome — the message is
 *  the card the user reads, so callers surface it verbatim. */
export class PackageReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageReadError';
  }
}

export interface ExtractProgress {
  percent: number;
  message: string;
}

export interface OpenedPackage {
  manifest: VidtsxManifest;
  /** Read one manifest-listed entry into memory (data entries only). */
  read(entryPath: string): Promise<Buffer>;
  /** Extract every manifest-listed entry under `destRoot`, hash-verified. */
  extractAll(destRoot: string, onProgress?: (p: ExtractProgress) => void): Promise<void>;
}

function assertInside(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, target);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new PackageReadError(`Package entry escapes the extraction folder: ${target}`);
  }
}

/** Resolve an entry path inside the root — the second zip-slip gate. */
export function resolvePackageEntry(root: string, entryPath: string): string {
  assertInside(root, entryPath);
  return path.resolve(root, entryPath);
}

/**
 * Open a package: read + validate the manifest, then check every declared
 * entry against the zip's central directory. Nothing is written to disk here,
 * so the import dialog can inspect a package cheaply before committing.
 */
export async function openPackage(filePath: string): Promise<OpenedPackage> {
  const unzipper = await import('unzipper');
  let directory;
  try {
    directory = await unzipper.Open.file(filePath);
  } catch {
    throw new PackageReadError('This file is not a readable .vidtsx package.');
  }

  const files = directory.files.filter((entry) => entry.type === 'File');
  if (files.length > PACKAGE_LIMITS.maxEntries) {
    throw new PackageReadError(
      `The package holds ${files.length} entries — the limit is ${PACKAGE_LIMITS.maxEntries}.`,
    );
  }

  const byPath = new Map<string, ZipFile>();
  for (const entry of files) {
    // A duplicate name is how a package tries to have the manifest describe
    // one file and the extractor write another.
    if (byPath.has(entry.path)) {
      throw new PackageReadError(`The package holds two entries named ${entry.path}.`);
    }
    byPath.set(entry.path, entry);
  }

  const manifestEntry = byPath.get(PACKAGE_MANIFEST_NAME);
  if (!manifestEntry) throw new PackageReadError('The package has no manifest.json.');
  if (manifestEntry.uncompressedSize > PACKAGE_LIMITS.maxManifestBytes) {
    throw new PackageReadError('The package manifest is implausibly large.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse((await manifestEntry.buffer()).toString('utf-8'));
  } catch {
    throw new PackageReadError('The package manifest is not readable JSON.');
  }

  const parsed = parsePackageManifest(raw);
  if (!parsed.ok) throw new PackageReadError(parsed.error);
  const manifest = parsed.manifest;

  // Declared == actual, entry by entry, BEFORE anything is written.
  for (const file of manifest.files) {
    const entry = byPath.get(file.path);
    if (!entry) {
      throw new PackageReadError(`The manifest lists ${file.path}, but the package has no such entry.`);
    }
    if (entry.uncompressedSize !== file.size) {
      throw new PackageReadError(
        `${file.path} is ${entry.uncompressedSize} bytes but the manifest declares ${file.size}.`,
      );
    }
  }

  const readEntry = async (entryPath: string): Promise<Buffer> => {
    const declared = manifest.files.find((file) => file.path === entryPath);
    // Manifest-as-allowlist: a caller cannot read an entry the manifest omits.
    if (!declared) throw new PackageReadError(`${entryPath} is not listed in the manifest.`);
    if (declared.size > PACKAGE_LIMITS.maxDataFileBytes) {
      throw new PackageReadError(`${entryPath} is too large to read into memory.`);
    }
    const buffer = await byPath.get(entryPath)!.buffer();
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (sha256 !== declared.sha256) {
      throw new PackageReadError(`${entryPath} does not match its manifest hash.`);
    }
    return buffer;
  };

  const extractAll = async (
    destRoot: string,
    onProgress?: (p: ExtractProgress) => void,
  ): Promise<void> => {
    await fs.mkdir(destRoot, { recursive: true });
    let done = 0;
    for (const file of manifest.files) {
      const target = resolvePackageEntry(destRoot, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });

      const hash = crypto.createHash('sha256');
      const tap = new Transform({
        transform(chunk: Buffer, _enc, callback) {
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(byPath.get(file.path)!.stream(), tap, createWriteStream(target));

      const digest = hash.digest('hex');
      if (digest !== file.sha256) {
        await fs.rm(target, { force: true });
        throw new PackageReadError(
          `${file.path} does not match its manifest hash — the package is corrupt or was tampered with.`,
        );
      }
      done += file.size;
      onProgress?.({
        percent: manifest.totalBytes > 0 ? (done / manifest.totalBytes) * 100 : 50,
        message: 'Unpacking…',
      });
    }
  };

  return { manifest, read: readEntry, extractAll };
}
