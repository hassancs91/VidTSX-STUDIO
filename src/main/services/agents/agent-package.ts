// Reading a `.vidtsxagent` file (agents plan §1.1 rules, §1.6 install).
//
// Three layers, deliberately separate:
//   1. `zip-reader.ts` guarantees the container is sane (caps, no duplicates,
//      manifest-as-allowlist, declared == actual, hash on every extracted byte).
//   2. `parseAgentManifest` decides whether the manifest is acceptable, given
//      what THIS build knows — its version, its registered tool ids, its
//      artifact and interaction kinds. It is pure, so `agent-pack --check`
//      runs the identical rules offline.
//   3. This file joins the two and adds what needs both: the signature (read
//      through the unlisted door, because `signature.json` cannot be hashed by
//      the manifest it signs) and the D14 composition gate on packaged TSX.
//
// Everything the running app supplies arrives as `AgentPackageDeps`. That is
// what keeps this file testable: the D14 gate is `validateAgentCompositionCode`
// in production, which reaches the module server and esbuild, and a two-line
// stub in a unit test.

import {
  openZipPackage,
  PackageReadError,
  type ExtractProgress,
  type OpenedZipPackage,
  type ZipReaderSpec,
} from '../packages/zip-reader';
import {
  AGENT_LIMITS,
  AGENT_MANIFEST_NAME,
  AgentManifestError,
  parseAgentManifest,
  type ManifestContext,
} from '../../../shared/agents/manifest';
import type { AgentPublisher } from '../../../shared/agents/publishers';
import type { AgentManifest } from '../../../shared/types/agents';
import {
  AGENT_LICENSEE_NAME,
  AGENT_SIDE_FILE_MAX_BYTES,
  AGENT_SIGNATURE_NAME,
  AgentSignatureError,
  parseLicenseeFile,
  parseSignatureFile,
  verifyAgentSignature,
  type AgentLicensee,
  type SignatureOutcome,
} from './agent-signing';

export { PackageReadError };
export type { ExtractProgress };

/** A composition check with the shape `validateAgentCompositionCode` returns. */
export type CompositionValidator = (code: string) => Promise<{ success: boolean; error?: string }>;

export interface AgentPackageDeps {
  /** What this build knows — app version, registered tool/artifact/kind ids. */
  manifestContext: ManifestContext;
  /** The D14 gate. Omitted = packaged TSX is not gated (offline `--check`). */
  validateComposition?: CompositionValidator;
  /** Overridable for tests; defaults to the shipped publisher list. */
  publishers?: readonly AgentPublisher[];
}

export interface OpenedAgentPackage {
  manifest: AgentManifest;
  /** `agent.json` byte for byte. The installed folder is folder-as-truth, so
   *  it needs the manifest on disk — and it must be these bytes, or the
   *  signature stops verifying the moment it is re-serialised. */
  manifestBytes: Buffer;
  signature: SignatureOutcome;
  licensee?: AgentLicensee;
  read(entryPath: string): Promise<Buffer>;
  extractAll(destRoot: string, onProgress?: (p: ExtractProgress) => void): Promise<void>;
  /** `signature.json` / `licensee.json` as they arrived — install writes them
   *  into the folder verbatim, so a later scan re-derives the same trust tag. */
  sideFiles: Array<{ name: string; body: Buffer }>;
}

function agentSpec(ctx: ManifestContext): ZipReaderSpec<AgentManifest> {
  return {
    manifestName: AGENT_MANIFEST_NAME,
    parseManifest(raw) {
      try {
        return parseAgentManifest(raw, ctx);
      } catch (err) {
        if (err instanceof AgentManifestError) {
          throw new PackageReadError(
            `This agent package cannot be installed:\n${err.problems.map((p) => `• ${p}`).join('\n')}`,
          );
        }
        throw err;
      }
    },
    filesOf: (manifest) => manifest.files,
    unlistedEntries: [AGENT_SIGNATURE_NAME, AGENT_LICENSEE_NAME],
    limits: {
      maxEntries: AGENT_LIMITS.maxEntries,
      maxManifestBytes: AGENT_LIMITS.maxManifestBytes,
      maxReadBytes: AGENT_LIMITS.maxEntryBytes,
      maxEntryBytes: AGENT_LIMITS.maxEntryBytes,
      maxTotalBytes: AGENT_LIMITS.maxTotalBytes,
    },
    notReadableMessage: 'This file is not a readable .vidtsxagent package.',
  };
}

async function readSideFile(
  zip: OpenedZipPackage<AgentManifest>,
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
 * Open and fully validate a package, WITHOUT writing anything: manifest rules,
 * signature outcome, and the D14 gate on packaged TSX. A tampered package
 * throws here, before an install has touched the disk.
 */
export async function openAgentPackage(
  filePath: string,
  deps: AgentPackageDeps,
): Promise<OpenedAgentPackage> {
  const zip = await openZipPackage(filePath, agentSpec(deps.manifestContext));
  const sideFiles: Array<{ name: string; body: Buffer }> = [];

  const signatureFile = await readSideFile(zip, AGENT_SIGNATURE_NAME);
  let signature: SignatureOutcome;
  if (signatureFile) {
    const parsed = parseSignatureFile(signatureFile.raw);
    if (!parsed) {
      throw new PackageReadError('The package signature.json is not a signature this app reads.');
    }
    try {
      // Against the RAW manifest: the publisher signed what they wrote, not
      // what zod normalised it into.
      signature = verifyAgentSignature(zip.rawManifest, parsed, deps.publishers);
    } catch (err) {
      // Refused, not downgraded to "unsigned": a signature that does not verify
      // is the one outcome that never installs.
      throw err instanceof AgentSignatureError ? new PackageReadError(err.message) : err;
    }
    sideFiles.push({ name: AGENT_SIGNATURE_NAME, body: signatureFile.body });
  } else {
    signature = { status: 'unsigned' };
  }

  const licenseeFile = await readSideFile(zip, AGENT_LICENSEE_NAME);
  const licensee = licenseeFile ? (parseLicenseeFile(licenseeFile.raw) ?? undefined) : undefined;
  if (licenseeFile && licensee) sideFiles.push({ name: AGENT_LICENSEE_NAME, body: licenseeFile.body });

  await gatePackagedCompositions(zip, deps.validateComposition);

  return {
    manifest: zip.manifest,
    manifestBytes: zip.manifestBytes,
    signature,
    licensee,
    read: zip.read,
    extractAll: zip.extractAll,
    sideFiles,
  };
}

/** Packaged entries the D14 gate applies to (§1.1: "TSX under `assets/`"). */
export function packagedCompositionPaths(manifest: AgentManifest): string[] {
  return manifest.files
    .map((f) => f.path)
    .filter((p) => p.startsWith('assets/') && p.toLowerCase().endsWith('.tsx'));
}

/**
 * The D14 gate: TSX an agent ships is code the app will transpile and render,
 * so it clears the same bar a generated shot does — transpile, single-file
 * import lint, parsable `compositionConfig`.
 */
async function gatePackagedCompositions(
  zip: OpenedZipPackage<AgentManifest>,
  validate: CompositionValidator | undefined,
): Promise<void> {
  if (!validate) return;
  for (const entryPath of packagedCompositionPaths(zip.manifest)) {
    const code = (await zip.read(entryPath)).toString('utf-8');
    const result = await validate(code);
    if (!result.success) {
      throw new PackageReadError(
        `${entryPath} is not a valid composition: ${result.error ?? 'unknown error'}`,
      );
    }
  }
}
