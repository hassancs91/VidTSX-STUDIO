// Reading a `.vidtsxtemplate` (docs/templates-plan.md §7) — the flows' three
// layers with the template manifest:
//   1. `zip-reader.ts` guarantees the container (caps, no duplicates,
//      manifest-as-allowlist, declared == actual, hash on every extracted byte).
//   2. `parseTemplatePackageManifest` decides whether `template.json` is
//      acceptable — pure, so `template-pack.mjs --check` runs the same rules.
//   3. This file joins the two and adds the signature (`signature.json` over
//      `template.json`, verified by the SAME `agent-signing.ts` and publisher
//      list) and the D14 gate on the entry: a template is code the app will
//      transpile and render, so it clears the bar a generated shot does.

import {
  openZipPackage,
  PackageReadError,
  type ExtractProgress,
  type OpenedZipPackage,
  type ZipReaderSpec,
} from '../packages/zip-reader';
import { TEMPLATE_MANIFEST_NAME, TemplateManifestError, type TemplateManifestContext } from '../../../shared/templates/manifest';
import { TEMPLATE_PACKAGE_LIMITS, parseTemplatePackageManifest } from '../../../shared/templates/template-package';
import type { TemplateManifest } from '../../../shared/types/templates';
import type { AgentPublisher } from '../../../shared/agents/publishers';
import type { TsxValidateResponse } from '../../../shared/ipc/types';
import {
  AGENT_LICENSEE_NAME,
  AGENT_SIDE_FILE_MAX_BYTES,
  AGENT_SIGNATURE_NAME,
  AgentSignatureError,
  parseLicenseeFile,
  parseSignatureFile,
  verifyAgentSignature,
  type SignatureOutcome,
} from '../agents/agent-signing';

export { PackageReadError };

export interface TemplatePackageDeps {
  manifestContext: TemplateManifestContext;
  /** The D14 gate (`validateAgentCompositionCode` in the app); omitted = ungated, for tests. */
  validateComposition?: (code: string) => Promise<TsxValidateResponse>;
  /** Overridable for tests; defaults to the shipped publisher list. */
  publishers?: readonly AgentPublisher[];
}

export interface OpenedTemplatePackage {
  manifest: TemplateManifest;
  /** `template.json` byte for byte — a re-serialised one would stop a signature verifying. */
  manifestBytes: Buffer;
  signature: SignatureOutcome;
  extractAll(destRoot: string, onProgress?: (p: ExtractProgress) => void): Promise<void>;
  /** `signature.json` / `licensee.json` as they arrived, written verbatim on install. */
  sideFiles: Array<{ name: string; body: Buffer }>;
}

function templateSpec(ctx: TemplateManifestContext): ZipReaderSpec<TemplateManifest> {
  return {
    manifestName: TEMPLATE_MANIFEST_NAME,
    parseManifest(raw) {
      try {
        return parseTemplatePackageManifest(raw, ctx);
      } catch (err) {
        if (err instanceof TemplateManifestError) {
          throw new PackageReadError(
            `This template package cannot be installed:\n${err.problems.map((p) => `• ${p}`).join('\n')}`,
          );
        }
        throw err;
      }
    },
    filesOf: (manifest) => manifest.files,
    unlistedEntries: [AGENT_SIGNATURE_NAME, AGENT_LICENSEE_NAME],
    limits: {
      maxEntries: TEMPLATE_PACKAGE_LIMITS.maxEntries,
      maxManifestBytes: TEMPLATE_PACKAGE_LIMITS.maxManifestBytes,
      maxReadBytes: TEMPLATE_PACKAGE_LIMITS.maxEntryBytes,
      maxEntryBytes: TEMPLATE_PACKAGE_LIMITS.maxEntryBytes,
      maxTotalBytes: TEMPLATE_PACKAGE_LIMITS.maxTotalBytes,
    },
    notReadableMessage: 'This file is not a readable .vidtsxtemplate package.',
  };
}

async function readSideFile(
  zip: OpenedZipPackage<TemplateManifest>,
  name: string,
): Promise<{ raw: unknown; body: Buffer } | null> {
  const body = await zip.readUnlisted(name, AGENT_SIDE_FILE_MAX_BYTES);
  if (!body) return null;
  try {
    return { raw: JSON.parse(body.toString('utf-8')) as unknown, body };
  } catch {
    throw new PackageReadError(`The package ${name} is not readable JSON.`);
  }
}

/**
 * Open and fully validate a template package WITHOUT writing anything:
 * manifest rules, the signature outcome, and the D14 gate on the entry. A
 * tampered or unrenderable package throws here, before the disk is touched.
 */
export async function openTemplatePackage(filePath: string, deps: TemplatePackageDeps): Promise<OpenedTemplatePackage> {
  const zip = await openZipPackage(filePath, templateSpec(deps.manifestContext));
  const sideFiles: Array<{ name: string; body: Buffer }> = [];

  const signatureFile = await readSideFile(zip, AGENT_SIGNATURE_NAME);
  let signature: SignatureOutcome;
  if (signatureFile) {
    const parsed = parseSignatureFile(signatureFile.raw);
    if (!parsed) throw new PackageReadError('The package signature.json is not a signature this app reads.');
    try {
      signature = verifyAgentSignature(zip.rawManifest, parsed, deps.publishers);
    } catch (err) {
      // A signature that does not verify never installs — it is not "unsigned".
      throw err instanceof AgentSignatureError ? new PackageReadError(err.message) : err;
    }
    sideFiles.push({ name: AGENT_SIGNATURE_NAME, body: signatureFile.body });
  } else {
    signature = { status: 'unsigned' };
  }
  const licenseeFile = await readSideFile(zip, AGENT_LICENSEE_NAME);
  if (licenseeFile && parseLicenseeFile(licenseeFile.raw)) {
    sideFiles.push({ name: AGENT_LICENSEE_NAME, body: licenseeFile.body });
  }

  if (deps.validateComposition) {
    const code = (await zip.read(zip.manifest.entry)).toString('utf-8');
    const result = await deps.validateComposition(code);
    if (!result.success) {
      throw new PackageReadError(`${zip.manifest.entry} is not a valid composition: ${result.error ?? 'unknown error'}`);
    }
  }

  return {
    manifest: zip.manifest,
    manifestBytes: zip.manifestBytes,
    signature,
    extractAll: zip.extractAll,
    sideFiles,
  };
}
