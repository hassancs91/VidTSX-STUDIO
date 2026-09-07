// The zip READ side shared by every package format the app opens — `.vidtsx`
// projects and `.vidtsxagent` agents (agents plan §5, §2 "zip layer extracted").
//
// A package is untrusted input, so this file is written as a gate, not a
// convenience. The four properties it guarantees, whatever the format:
//
//   1. **The manifest is the allowlist.** Entries the manifest does not list
//      are ignored, whatever the central directory says. A package cannot
//      smuggle a file past the reader by simply putting it in the zip. The one
//      exception is `spec.unlistedEntries` — a short, explicit list of names a
//      format reads OUTSIDE the manifest (an agent's `signature.json` cannot be
//      hashed by the manifest it signs), each read under its own size cap.
//   2. **Zip-slip is checked twice.** The format's manifest parser runs the
//      string-only name check (`isSafeEntryPath`) before any resolve, and every
//      extraction target is then resolved and asserted to live inside the
//      extraction root.
//   3. **Declared size == actual size.** Every manifest entry is matched
//      against the zip's own uncompressed size before a byte is written, so a
//      capped manifest cannot front for a zip bomb.
//   4. **Every extracted file is hashed as it lands.** A mismatch unlinks the
//      file and fails the read — a corrupt or tampered package never becomes
//      a project or an installed agent.
//
// Format-specific rules (which fields exist, what the ids mean, how big a
// caption pack may be) belong in the format's own parser, which arrives here as
// `spec.parseManifest`.

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import type { File as ZipFile } from 'unzipper';

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

/** The three fields the reader needs from a manifest's file list. A format may
 *  carry more per entry; the reader neither knows nor cares. */
export interface ZipEntryDeclaration {
  path: string;
  size: number;
  sha256: string;
}

export interface ZipReaderLimits {
  maxEntries: number;
  maxManifestBytes: number;
  /** Cap on `read()`, which buffers an entry in memory. */
  maxReadBytes: number;
  /** Optional declared-size ceilings, checked before anything is written.
   *  Formats whose own parser already enforces them may omit these. */
  maxEntryBytes?: number;
  maxTotalBytes?: number;
}

export interface ZipReaderSpec<TManifest> {
  manifestName: string;
  /** Parse the manifest object, or throw with a user-facing message. */
  parseManifest(raw: unknown): TManifest;
  filesOf(manifest: TManifest): readonly ZipEntryDeclaration[];
  /** Denominator for extraction progress; defaults to the sum of file sizes. */
  totalBytesOf?(manifest: TManifest): number;
  /** Names readable outside the manifest allowlist — see property 1 above. */
  unlistedEntries?: readonly string[];
  limits: ZipReaderLimits;
  /** Shown when the file is not a readable zip at all. */
  notReadableMessage: string;
}

export interface OpenedZipPackage<TManifest> {
  manifest: TManifest;
  /** The manifest exactly as it was parsed from JSON, before the format's
   *  parser normalised it. A signature covers what the PUBLISHER wrote, so it
   *  must be checked against this — a parser that fills a default or drops an
   *  unknown key would otherwise invalidate every signature it touches. */
  rawManifest: unknown;
  /** The manifest entry EXACTLY as it was packed. A format that copies the
   *  manifest out of the zip must write these bytes, not a re-serialisation:
   *  a signature covers bytes, and JSON.stringify does not round-trip them. */
  manifestBytes: Buffer;
  /** Read one manifest-listed entry into memory, hash-verified. */
  read(entryPath: string): Promise<Buffer>;
  /** Read one `spec.unlistedEntries` name, or null when the zip omits it.
   *  Unhashed by construction, so `maxBytes` is the only guard. */
  readUnlisted(entryPath: string, maxBytes: number): Promise<Buffer | null>;
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

/** Index the zip's file entries, refusing over-long and duplicated names. */
async function indexEntries(
  filePath: string,
  spec: ZipReaderSpec<unknown>,
): Promise<Map<string, ZipFile>> {
  const unzipper = await import('unzipper');
  let directory;
  try {
    directory = await unzipper.Open.file(filePath);
  } catch {
    throw new PackageReadError(spec.notReadableMessage);
  }

  const files = directory.files.filter((entry) => entry.type === 'File');
  if (files.length > spec.limits.maxEntries) {
    throw new PackageReadError(
      `The package holds ${files.length} entries — the limit is ${spec.limits.maxEntries}.`,
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
  return byPath;
}

/**
 * Open a package: read + validate the manifest, then check every declared
 * entry against the zip's central directory. Nothing is written to disk here,
 * so a caller can inspect a package cheaply before committing to it.
 */
export async function openZipPackage<TManifest>(
  filePath: string,
  spec: ZipReaderSpec<TManifest>,
): Promise<OpenedZipPackage<TManifest>> {
  const byPath = await indexEntries(filePath, spec as ZipReaderSpec<unknown>);

  const manifestEntry = byPath.get(spec.manifestName);
  if (!manifestEntry) throw new PackageReadError(`The package has no ${spec.manifestName}.`);
  if (manifestEntry.uncompressedSize > spec.limits.maxManifestBytes) {
    throw new PackageReadError('The package manifest is implausibly large.');
  }

  const manifestBytes = await manifestEntry.buffer();
  let raw: unknown;
  try {
    raw = JSON.parse(manifestBytes.toString('utf-8'));
  } catch {
    throw new PackageReadError('The package manifest is not readable JSON.');
  }

  const manifest = spec.parseManifest(raw);
  const declared = spec.filesOf(manifest);

  // Declared == actual, entry by entry, BEFORE anything is written.
  let total = 0;
  for (const file of declared) {
    const entry = byPath.get(file.path);
    if (!entry) {
      throw new PackageReadError(
        `The manifest lists ${file.path}, but the package has no such entry.`,
      );
    }
    if (entry.uncompressedSize !== file.size) {
      throw new PackageReadError(
        `${file.path} is ${entry.uncompressedSize} bytes but the manifest declares ${file.size}.`,
      );
    }
    if (spec.limits.maxEntryBytes !== undefined && file.size > spec.limits.maxEntryBytes) {
      throw new PackageReadError(
        `${file.path} is ${file.size} bytes — the per-file limit is ${spec.limits.maxEntryBytes}.`,
      );
    }
    total += file.size;
  }
  if (spec.limits.maxTotalBytes !== undefined && total > spec.limits.maxTotalBytes) {
    throw new PackageReadError(
      `The package unpacks to ${total} bytes — the limit is ${spec.limits.maxTotalBytes}.`,
    );
  }

  const totalBytes = spec.totalBytesOf ? spec.totalBytesOf(manifest) : total;

  const read = async (entryPath: string): Promise<Buffer> => {
    const entry = declared.find((file) => file.path === entryPath);
    // Manifest-as-allowlist: a caller cannot read an entry the manifest omits.
    if (!entry) throw new PackageReadError(`${entryPath} is not listed in the manifest.`);
    if (entry.size > spec.limits.maxReadBytes) {
      throw new PackageReadError(`${entryPath} is too large to read into memory.`);
    }
    const buffer = await byPath.get(entryPath)!.buffer();
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (sha256 !== entry.sha256) {
      throw new PackageReadError(`${entryPath} does not match its manifest hash.`);
    }
    return buffer;
  };

  const readUnlisted = async (entryPath: string, maxBytes: number): Promise<Buffer | null> => {
    if (!spec.unlistedEntries?.includes(entryPath)) {
      throw new PackageReadError(`${entryPath} may not be read outside the manifest.`);
    }
    const entry = byPath.get(entryPath);
    if (!entry) return null;
    if (entry.uncompressedSize > maxBytes) {
      throw new PackageReadError(`${entryPath} is larger than ${maxBytes} bytes.`);
    }
    return entry.buffer();
  };

  const extractAll = async (
    destRoot: string,
    onProgress?: (p: ExtractProgress) => void,
  ): Promise<void> => {
    await fs.mkdir(destRoot, { recursive: true });
    let done = 0;
    for (const file of declared) {
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
        percent: totalBytes > 0 ? (done / totalBytes) * 100 : 50,
        message: 'Unpacking…',
      });
    }
  };

  return { manifest, rawManifest: raw, manifestBytes, read, readUnlisted, extractAll };
}
