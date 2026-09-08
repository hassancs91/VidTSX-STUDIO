// The shipped publisher list. These assertions exist because a bad entry here
// fails SILENTLY: `verifyAgentSignature` matches on key bytes, so a truncated
// or mistyped base64 simply never matches, and every VidTSX-signed package
// reads "Signed, unverified publisher" with no error anywhere. Nothing else in
// the suite would notice — every other signing test injects its own list.

import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { AGENT_PUBLISHERS, findPublisherByKey } from './publishers';

describe('AGENT_PUBLISHERS', () => {
  it('ships VidTSX, so a package we signed can read "Verified by VidTSX"', () => {
    expect(AGENT_PUBLISHERS.map((p) => p.keyId)).toContain('vidtsx-1');
  });

  it('every entry is a real ed25519 public key in SPKI DER base64', () => {
    for (const publisher of AGENT_PUBLISHERS) {
      const der = Buffer.from(publisher.publicKey, 'base64');
      const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
      expect(key.asymmetricKeyType).toBe('ed25519');
      // Round-tripping catches a base64 string that decodes but is not exactly
      // what the app will compare against — trailing whitespace, a stray char.
      expect(key.export({ format: 'der', type: 'spki' }).toString('base64')).toBe(
        publisher.publicKey,
      );
    }
  });

  it('never carries a private key', () => {
    // The one mistake with real consequences: pasting the first block the
    // --genkey output prints instead of the second.
    for (const publisher of AGENT_PUBLISHERS) {
      expect(publisher.publicKey).not.toMatch(/PRIVATE/i);
      expect(Buffer.from(publisher.publicKey, 'base64')).toHaveLength(44);
    }
  });

  it('has no duplicate keyIds or repeated keys', () => {
    const ids = AGENT_PUBLISHERS.map((p) => p.keyId);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = AGENT_PUBLISHERS.map((p) => p.publicKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('finds the shipped key by its bytes, and is not fooled by a claimed keyId', () => {
    const vidtsx = AGENT_PUBLISHERS.find((p) => p.keyId === 'vidtsx-1');
    expect(findPublisherByKey(vidtsx!.publicKey)).toBe(vidtsx);
    // An impostor naming its key 'vidtsx-1' carries different bytes.
    const impostor = crypto
      .generateKeyPairSync('ed25519')
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64');
    expect(findPublisherByKey(impostor)).toBeUndefined();
  });
});
