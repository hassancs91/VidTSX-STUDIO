// Zip READ side for `.vidtsx` packages — the `.vidtsx` half of the security
// boundary (Q7e).
//
// The mechanics (entry caps, duplicate names, manifest-as-allowlist,
// declared-size checks, the two zip-slip gates, hash-on-write) moved to
// `services/packages/zip-reader.ts` when the agents package format arrived
// (agents plan §5), because both formats need exactly those guarantees and a
// security gate should exist once. What stays here is what is specific to
// `.vidtsx`: the manifest name, the manifest parser, this format's limits, and
// the sentence a user sees when the file is not one of our packages.
//
// The `.vidtsx` manifest parser enforces its own per-entry (`entrySizeLimit`,
// media vs data) and total-size rules, which is why no generic `maxEntryBytes`
// or `maxTotalBytes` is handed to the reader — a single flat cap here would be
// weaker than what `parsePackageManifest` already applies.

import {
  openZipPackage,
  PackageReadError,
  resolvePackageEntry,
  type ExtractProgress,
  type OpenedZipPackage,
  type ZipReaderSpec,
} from '../packages/zip-reader';
import {
  PACKAGE_LIMITS,
  PACKAGE_MANIFEST_NAME,
  type VidtsxManifest,
} from '../../../shared/studio/project-package';
import { parsePackageManifest } from '../../../shared/studio/project-package-manifest';

export { PackageReadError, resolvePackageEntry };
export type { ExtractProgress };

export type OpenedPackage = OpenedZipPackage<VidtsxManifest>;

const VIDTSX_SPEC: ZipReaderSpec<VidtsxManifest> = {
  manifestName: PACKAGE_MANIFEST_NAME,
  parseManifest(raw) {
    const parsed = parsePackageManifest(raw);
    if (!parsed.ok) throw new PackageReadError(parsed.error);
    return parsed.manifest;
  },
  filesOf: (manifest) => manifest.files,
  totalBytesOf: (manifest) => manifest.totalBytes,
  limits: {
    maxEntries: PACKAGE_LIMITS.maxEntries,
    maxManifestBytes: PACKAGE_LIMITS.maxManifestBytes,
    maxReadBytes: PACKAGE_LIMITS.maxDataFileBytes,
  },
  notReadableMessage: 'This file is not a readable .vidtsx package.',
};

/**
 * Open a `.vidtsx` package: read + validate the manifest, then check every
 * declared entry against the zip's central directory. Nothing is written to
 * disk here, so the import dialog can inspect a package cheaply before
 * committing.
 */
export async function openPackage(filePath: string): Promise<OpenedPackage> {
  return openZipPackage(filePath, VIDTSX_SPEC);
}
