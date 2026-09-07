// Package signing for `.vidtsxagent` (agents plan §1.6).
//
// The signature covers the CANONICAL JSON of `agent.json`, and nothing else —
// which is enough, because the manifest already carries a sha256 for every
// packaged file. So one ed25519 signature over a few hundred bytes transitively
// covers the whole tree, and the reader's existing hash-on-write check is what
// enforces it.
//
// `signature.json` is therefore never listed in `files[]` (it cannot hash the
// manifest that would have to hash it), which is why it is read through the
// zip reader's explicit `unlistedEntries` door rather than the allowlist.
//
// Deliberately free of Electron and of app state: `scripts/agent-pack.mjs`
// bundles this same module to sign with, so signer and verifier can never drift
// apart on what "canonical" means.

import crypto from 'crypto';
import { findPublisherByKey, type AgentPublisher } from '../../../shared/agents/publishers';
import type { AgentSignatureStatus } from '../../../shared/types/agents';

export const AGENT_SIGNATURE_NAME = 'signature.json';
export const AGENT_LICENSEE_NAME = 'licensee.json';
/** Both side files are tiny JSON; anything larger is not what it claims to be. */
export const AGENT_SIDE_FILE_MAX_BYTES = 8 * 1024;

export interface AgentSignatureFile {
  alg: 'ed25519';
  keyId: string;
  /** base64 SPKI DER. */
  publicKey: string;
  /** base64 raw signature over `canonicalJson(manifest)`. */
  signature: string;
}

/** The store's per-buyer stamp — outside the signature by design (§1.6). */
export interface AgentLicensee {
  name: string;
  orderId?: string;
  issuedAt?: string;
}

export class AgentSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSignatureError';
  }
}

/**
 * Deterministic JSON: object keys sorted, arrays in order, no whitespace.
 * Anything that cannot round-trip identically (undefined, functions, NaN) is a
 * hard error rather than a silent omission — a byte the signer dropped and the
 * verifier kept is exactly how a signature scheme fails open.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new AgentSignatureError('Manifest holds a non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new AgentSignatureError(`Manifest holds an unserializable value (${typeof value})`);
}

/** Narrow an unknown `signature.json` body. Returns null when it is not one. */
export function parseSignatureFile(raw: unknown): AgentSignatureFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.alg !== 'ed25519') return null;
  const { keyId, publicKey, signature } = obj;
  if (typeof keyId !== 'string' || keyId.length === 0 || keyId.length > 64) return null;
  if (typeof publicKey !== 'string' || typeof signature !== 'string') return null;
  return { alg: 'ed25519', keyId, publicKey, signature };
}

export function parseLicenseeFile(raw: unknown): AgentLicensee | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.length === 0) return null;
  return {
    name: obj.name.slice(0, 200),
    orderId: typeof obj.orderId === 'string' ? obj.orderId.slice(0, 100) : undefined,
    issuedAt: typeof obj.issuedAt === 'string' ? obj.issuedAt.slice(0, 40) : undefined,
  };
}

function publicKeyFrom(base64: string): crypto.KeyObject {
  try {
    return crypto.createPublicKey({
      key: Buffer.from(base64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    throw new AgentSignatureError('The package signature carries an unreadable public key.');
  }
}

export interface SignatureOutcome {
  status: AgentSignatureStatus;
  /** Present whenever the package was signed. */
  keyId?: string;
  /** Publisher display name, only for `verified`. */
  publisher?: string;
}

/**
 * Verify a manifest against its `signature.json`.
 *
 * `null` signature = `unsigned` (installable, warned about). A signature that
 * does not verify THROWS: the plan's "invalid = refused" outcome, and the only
 * one of the four that never reaches an install.
 */
export function verifyAgentSignature(
  manifest: unknown,
  signature: AgentSignatureFile | null,
  publishers?: readonly AgentPublisher[],
): SignatureOutcome {
  if (!signature) return { status: 'unsigned' };

  const key = publicKeyFrom(signature.publicKey);
  let ok = false;
  try {
    ok = crypto.verify(
      null, // ed25519 signs the message directly
      Buffer.from(canonicalJson(manifest), 'utf-8'),
      key,
      Buffer.from(signature.signature, 'base64'),
    );
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new AgentSignatureError(
      'The package signature does not match its manifest — it is corrupt or was tampered with.',
    );
  }

  // Matched on key bytes, never on the (attacker-controlled) keyId.
  const publisher = findPublisherByKey(signature.publicKey, publishers);
  return publisher
    ? { status: 'verified', keyId: publisher.keyId, publisher: publisher.name }
    : { status: 'signed-unknown', keyId: signature.keyId };
}

/** Sign a manifest. Used only by `scripts/agent-pack.mjs`; the app never signs. */
export function signAgentManifest(
  manifest: unknown,
  privateKeyPem: string,
  keyId: string,
): AgentSignatureFile {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new AgentSignatureError(
      `Signing key must be ed25519, got ${String(privateKey.asymmetricKeyType)}.`,
    );
  }
  const signature = crypto.sign(
    null,
    Buffer.from(canonicalJson(manifest), 'utf-8'),
    privateKey,
  );
  const publicKey = crypto
    .createPublicKey(privateKey)
    .export({ format: 'der', type: 'spki' })
    .toString('base64');
  return { alg: 'ed25519', keyId, publicKey, signature: signature.toString('base64') };
}
