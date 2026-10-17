// The signing key for the three packers (agent-pack.mjs, flow-pack.mjs,
// template-pack.mjs): where it is read from, which name it signs under, and
// how a new one is made. Shared so the three cannot drift.
//
// The NAME comes from the key itself: a key whose public half is in
// `src/shared/agents/publishers.ts` signs under that entry's keyId, so
// `--key-id` is never needed for a VidTSX key and can never mislabel one (the
// lost-key rotation of 2026-10-17, vidtsx-1 → vidtsx-2, is why). Any other key
// must be named with `--key-id`, and not with a name a trusted key already
// uses. It still signs; the package installs as "Signed, unverified publisher".
//
// A new key (`--genkey`) is written STRAIGHT TO A FILE, outside every repo,
// and never printed: only its public half and the publishers.ts entry are.
// The private key must never pass through a terminal log or a session.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/** Where `--genkey` writes a key unless told otherwise: `~/.vidtsx/keys/<keyId>.pem`. */
export function defaultKeyPath(keyId) {
  return path.join(os.homedir(), '.vidtsx', 'keys', `${keyId}.pem`);
}

/** A PEM private key's public half as publishers.ts holds it: base64 SPKI DER. */
export function publicKeyOf(pem) {
  return crypto.createPublicKey(pem).export({ format: 'der', type: 'spki' }).toString('base64');
}

/**
 * The name a key signs under. `trust` is the app's own list and finder
 * (`AGENT_PUBLISHERS`, `findPublisherByKey` from publishers.ts). Throws an
 * Error whose message is the line to show.
 */
export function signingIdentity(pem, requestedKeyId, trust) {
  const publisher = trust.findPublisherByKey(publicKeyOf(pem), trust.AGENT_PUBLISHERS);
  if (publisher) {
    if (requestedKeyId && requestedKeyId !== publisher.keyId) {
      throw new Error(
        `This key is ${publisher.keyId} (${publisher.name}) in publishers.ts, not "${requestedKeyId}". Drop --key-id, or use the key that is ${requestedKeyId}.`,
      );
    }
    return { keyId: publisher.keyId, publisher };
  }
  if (!requestedKeyId) {
    throw new Error(
      'This key is not in src/shared/agents/publishers.ts, so it has no name: pass --key-id <name>. It signs, and installs as "Signed, unverified publisher".',
    );
  }
  const taken = trust.AGENT_PUBLISHERS.find((p) => p.keyId === requestedKeyId);
  if (taken) {
    throw new Error(
      `"${requestedKeyId}" is the name of a different, trusted key (${taken.name}) in publishers.ts. A lost or new key gets a NEW name (e.g. the next number); a name is never reused.`,
    );
  }
  return { keyId: requestedKeyId, publisher: null };
}

/**
 * The key named by `--key <path>`, else by `VIDTSX_AGENT_SIGNING_KEY`, with
 * the name it signs under; null when neither is set. Throws on an unreadable
 * file or a name problem (see `signingIdentity`).
 */
export async function readSigningKey(flags, trust) {
  const keyPath = typeof flags.key === 'string' ? flags.key : process.env.VIDTSX_AGENT_SIGNING_KEY;
  if (!keyPath) return null;
  let pem;
  try {
    pem = await fs.readFile(keyPath, 'utf-8');
  } catch (err) {
    throw new Error(`Could not read the signing key at ${keyPath}: ${err.message}`);
  }
  const requested = typeof flags['key-id'] === 'string' ? flags['key-id'] : undefined;
  return { pem, ...signingIdentity(pem, requested, trust) };
}

/** "vidtsx-2 (VidTSX, trusted)" or "acme-1 (not in publishers.ts: …)" — what a packer prints after signing. */
export function describeSigner(key) {
  return key.publisher
    ? `${key.keyId} (${key.publisher.name}, trusted)`
    : `${key.keyId} (not in publishers.ts: installs as "Signed, unverified publisher")`;
}

/**
 * A new ed25519 key, written to `outPath` (default `~/.vidtsx/keys/<keyId>.pem`).
 * Refuses to overwrite a file. Returns the path and the public half; the
 * private half is never returned or printed.
 */
export async function generateKeyFile(keyId, outPath = defaultKeyPath(keyId)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  try {
    await fs.writeFile(outPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error(`${outPath} already exists: a key is never overwritten. Pick a new --key-id or --out.`);
    throw err;
  }
  return { path: outPath, publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') };
}
