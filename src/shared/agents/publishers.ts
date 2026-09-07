// Known agent publishers — PUBLIC keys only (agents plan §1.6).
//
// This file is the whole of "Verified by VidTSX": a package whose signature
// verifies against one of these keys gets the accent trust tag; a valid
// signature by any other key is "Signed, unverified publisher", which installs
// just the same. Nothing here grants capability, so a key landing in the repo
// is a claim about identity, not a secret. The matching PRIVATE key never
// enters the repo — `scripts/agent-pack.mjs` reads it from a file named by
// `VIDTSX_AGENT_SIGNING_KEY`.
//
// A publisher is matched by its KEY BYTES, not by `keyId`: the keyId in a
// package's `signature.json` is attacker-controlled, so matching on it would
// let anyone claim to be VidTSX by naming their key `vidtsx-1`.

export interface AgentPublisher {
  /** Short, stable label shown when the key is not one of ours. */
  keyId: string;
  /** Display name for the trust tag. */
  name: string;
  /** ed25519 public key, base64 SPKI DER — what `agent-pack --genkey` prints. */
  publicKey: string;
}

/**
 * Empty until VidTSX's own signing key is generated (`agent-pack.mjs --genkey`,
 * private half stored outside the repo). Until then every signed package reads
 * as "Signed, unverified publisher", which is the correct answer: no key has
 * been published, so no signature can be attributed to us.
 */
export const AGENT_PUBLISHERS: readonly AgentPublisher[] = [];

/** The publisher owning this exact key, or undefined. */
export function findPublisherByKey(
  publicKey: string,
  publishers: readonly AgentPublisher[] = AGENT_PUBLISHERS,
): AgentPublisher | undefined {
  const normalized = publicKey.replace(/\s+/g, '');
  return publishers.find((p) => p.publicKey.replace(/\s+/g, '') === normalized);
}
