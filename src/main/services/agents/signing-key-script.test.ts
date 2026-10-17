// `scripts/signing-key.mjs` — the signing key the three packers share (after
// the 2026-10-17 lost-key rotation, vidtsx-1 → vidtsx-2): a key in
// publishers.ts signs under ITS name, any other key needs a name no trusted
// key uses, and `--genkey` writes a new key straight to a file and never prints
// it. The name rules are unit-tested against a fake publisher list; `--genkey`
// runs the REAL agent-pack.mjs in a child process.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { findPublisherByKey, type AgentPublisher } from '../../../shared/agents/publishers';

const run = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const AGENT_PACK = path.join(REPO_ROOT, 'scripts', 'agent-pack.mjs');

interface Trust {
  AGENT_PUBLISHERS: readonly AgentPublisher[];
  findPublisherByKey: typeof findPublisherByKey;
}
interface SigningKeyModule {
  publicKeyOf(pem: string): string;
  signingIdentity(pem: string, requestedKeyId: string | undefined, trust: Trust): { keyId: string; publisher: AgentPublisher | null };
  readSigningKey(flags: Record<string, unknown>, trust: Trust): Promise<{ pem: string; keyId: string } | null>;
}
// A dynamic import of a computed path: the .mjs has no types, and this keeps it out of the type check.
const mod = (await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'signing-key.mjs')).href)) as SigningKeyModule;

function newKey(): { pem: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    pem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

const ours = newKey();
const trust: Trust = { AGENT_PUBLISHERS: [{ keyId: 'acme-2', name: 'Acme', publicKey: ours.publicKey }], findPublisherByKey };

let dir = '';
let savedEnv: string | undefined;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'signing-key-'));
  // Never the real key: whatever the machine sets is hidden for the test.
  savedEnv = process.env.VIDTSX_AGENT_SIGNING_KEY;
  delete process.env.VIDTSX_AGENT_SIGNING_KEY;
});

afterEach(async () => {
  if (savedEnv === undefined) delete process.env.VIDTSX_AGENT_SIGNING_KEY;
  else process.env.VIDTSX_AGENT_SIGNING_KEY = savedEnv;
  await fs.rm(dir, { recursive: true, force: true });
});

describe('signingIdentity', () => {
  it('a trusted key signs under its own name; --key-id may repeat it but never rename it', () => {
    expect(mod.publicKeyOf(ours.pem)).toBe(ours.publicKey);
    expect(mod.signingIdentity(ours.pem, undefined, trust)).toMatchObject({ keyId: 'acme-2', publisher: { name: 'Acme' } });
    expect(mod.signingIdentity(ours.pem, 'acme-2', trust).keyId).toBe('acme-2');
    expect(() => mod.signingIdentity(ours.pem, 'acme-1', trust)).toThrow('This key is acme-2 (Acme) in publishers.ts, not "acme-1"');
  });

  it("any other key needs a name, and not a trusted key's name", () => {
    const other = newKey();
    expect(() => mod.signingIdentity(other.pem, undefined, trust)).toThrow('pass --key-id <name>');
    expect(() => mod.signingIdentity(other.pem, 'acme-2', trust)).toThrow('"acme-2" is the name of a different, trusted key (Acme)');
    expect(mod.signingIdentity(other.pem, 'beta-1', trust)).toEqual({ keyId: 'beta-1', publisher: null });
  });
});

describe('readSigningKey', () => {
  it('reads --key, else VIDTSX_AGENT_SIGNING_KEY, else nothing; an unreadable file says where it looked', async () => {
    const file = path.join(dir, 'acme-2.pem');
    await fs.writeFile(file, ours.pem, 'utf-8');
    expect(await mod.readSigningKey({}, trust)).toBeNull();
    expect(await mod.readSigningKey({ key: file }, trust)).toMatchObject({ keyId: 'acme-2' });
    process.env.VIDTSX_AGENT_SIGNING_KEY = file;
    expect(await mod.readSigningKey({}, trust)).toMatchObject({ keyId: 'acme-2' });
    await expect(mod.readSigningKey({ key: path.join(dir, 'gone.pem') }, trust)).rejects.toThrow('Could not read the signing key at');
  });
});

describe('agent-pack.mjs --genkey', () => {
  const env = () => {
    const e = { ...process.env };
    delete e.VIDTSX_AGENT_SIGNING_KEY;
    return e;
  };

  it('writes the key to a file, prints only its public half, and never overwrites', async () => {
    const out = path.join(dir, 'keys', 'test-9.pem');
    const { stdout } = await run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'test-9', '--out', out], { env: env() });
    const pem = await fs.readFile(out, 'utf-8');
    expect(pem).toContain('BEGIN PRIVATE KEY');
    expect(stdout).not.toContain('PRIVATE KEY-----');
    expect(stdout).toContain(`private key written to ${out}`);
    expect(stdout).toContain(`publicKey: '${mod.publicKeyOf(pem)}'`);
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'test-9', '--out', out], { env: env() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('already exists'),
    });
    expect(await fs.readFile(out, 'utf-8')).toBe(pem);
  }, 60_000);

  it('refuses without a name, and with a name publishers.ts already uses', async () => {
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--out', path.join(dir, 'a.pem')], { env: env() })).rejects.toMatchObject({
      stderr: expect.stringContaining('--genkey needs --key-id'),
    });
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'vidtsx-2', '--out', path.join(dir, 'b.pem')], { env: env() })).rejects.toMatchObject({
      stderr: expect.stringContaining('"vidtsx-2" is already a key in publishers.ts'),
    });
    expect(await fs.readdir(dir)).toEqual([]);
  }, 60_000);
});
