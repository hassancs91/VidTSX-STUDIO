// A `.vidtsxtemplate` — one template folder, zipped (docs/templates-plan.md §7).
//
// PURE, like `manifest.ts`: the manifest rules a folder scan applies, plus what
// only a PACKAGE must prove — that `files[]` lists everything the template
// will open. `scripts/template-pack.mjs --check` bundles this exact function,
// so a package that passes the author's check passes the install.
//
// The container itself (caps, hashes, no unlisted entries) is `zip-reader.ts`'s
// job; this file decides whether the manifest INSIDE is acceptable.

import { isSafeEntryPath } from '../packages/entry-path';
import {
  TEMPLATE_MANIFEST_NAME,
  TemplateManifestError,
  isFileControl,
  parseTemplateManifest,
  type TemplateManifestContext,
} from './manifest';
import type { TemplateManifest } from '../types/templates';

/** Container caps. Templates carry artwork and sound (a music bed is a few MB). */
export const TEMPLATE_PACKAGE_LIMITS = {
  maxEntries: 300,
  maxTotalBytes: 128 * 1024 * 1024,
  maxEntryBytes: 64 * 1024 * 1024,
  maxManifestBytes: 256 * 1024,
} as const;

/** Written by the store or the signer, never listed in `files[]`. */
export const TEMPLATE_RESERVED_ENTRIES: readonly string[] = [TEMPLATE_MANIFEST_NAME, 'signature.json', 'licensee.json'];

/** Every file path a default or a preset of a file control names (no ''). */
export function templateReferencedFiles(manifest: TemplateManifest): string[] {
  const fileKeys = new Set(manifest.controls.filter(isFileControl).map((c) => c.key));
  const values = [
    ...manifest.controls.filter((c) => fileKeys.has(c.key)).map((c) => c.default),
    ...manifest.presets.flatMap((p) => Object.entries(p.values).filter(([k]) => fileKeys.has(k)).map(([, v]) => v)),
  ];
  const paths = values.filter((v): v is string => typeof v === 'string' && v !== '');
  return [...new Set(paths)];
}

/**
 * The manifest of a template PACKAGE: everything `parseTemplateManifest`
 * checks, plus a `files[]` that covers the entry, the thumbnail and every
 * bundled default — an install that later fails to find its own composition
 * is refused here instead. Throws `TemplateManifestError` with every problem.
 */
export function parseTemplatePackageManifest(raw: unknown, ctx: TemplateManifestContext = {}): TemplateManifest {
  const manifest = parseTemplateManifest(raw, ctx);
  const problems: string[] = [];

  const listed = new Set<string>();
  let totalBytes = 0;
  for (const file of manifest.files) {
    if (listed.has(file.path)) problems.push(`files: "${file.path}" is listed twice`);
    listed.add(file.path);
    if (TEMPLATE_RESERVED_ENTRIES.includes(file.path)) {
      problems.push(`files: "${file.path}" is reserved — the packer writes it`);
    }
    if (isSafeEntryPath(file.path) && file.size > TEMPLATE_PACKAGE_LIMITS.maxEntryBytes) {
      problems.push(`files: "${file.path}" is ${file.size} bytes (max ${TEMPLATE_PACKAGE_LIMITS.maxEntryBytes})`);
    }
    totalBytes += file.size;
  }
  if (manifest.files.length === 0) problems.push('files[] is empty — pack the folder with scripts/template-pack.mjs');
  if (manifest.files.length > TEMPLATE_PACKAGE_LIMITS.maxEntries) {
    problems.push(`files[] has ${manifest.files.length} entries (max ${TEMPLATE_PACKAGE_LIMITS.maxEntries})`);
  }
  if (totalBytes > TEMPLATE_PACKAGE_LIMITS.maxTotalBytes) {
    problems.push(`files: ${totalBytes} bytes total (max ${TEMPLATE_PACKAGE_LIMITS.maxTotalBytes})`);
  }

  if (!listed.has(manifest.entry)) problems.push(`entry "${manifest.entry}" is not listed in files[]`);
  if (manifest.thumbnail && !listed.has(manifest.thumbnail)) {
    problems.push(`thumbnail "${manifest.thumbnail}" is not listed in files[]`);
  }
  for (const rel of templateReferencedFiles(manifest)) {
    if (!listed.has(rel)) problems.push(`"${rel}" is named by a default or a preset but not listed in files[]`);
  }

  if (problems.length > 0) throw new TemplateManifestError(problems);
  return manifest;
}
