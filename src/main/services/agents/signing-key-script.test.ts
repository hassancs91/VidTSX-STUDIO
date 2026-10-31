// `scripts/signing-key.mjs` — the signing key the three packers share (after
// the 2026-10-17 lost-key rotation, vidtsx-1 → vidtsx-2): a key in
// publishers.ts signs under ITS name, any other key needs a name no trusted
// key uses, and `--genkey` writes a new key straight to a file and never prints
// it. The name rules are unit-tested against a fake publisher list; `--genkey`
// runs the REAL agent-pack.mjs in a child process. Since vidtsx-3 (2026-10-31,
// replacing vidtsx-2) the key file is encrypted and signing asks a person for
// the passphrase: the unlock is
// tested with an injected `ask`, the hidden prompt with a fake terminal.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile } from 'child_process';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { AGENT_PUBLISHERS, findPublisherByKey, type AgentPublisher } from '../../../shared/agents/publishers';

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
  readSigningKey(
    flags: Record<string, unknown>,
    trust: Trust,
    ask?: (question: string) => Promise<string>,
  ): Promise<{ pem: string; keyId: string } | null>;
  generateKeyFile(keyId: string, outPath: string, passphrase?: string): Promise<{ path: string; publicKey: string }>;
  isEncryptedPem(pem: string): boolean;
  unlockPem(pem: string, passphrase: string): string;
  askHidden(question: string, stdin: unknown, out: { write(text: string): unknown }): Promise<string>;
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

  it('an encrypted key asks once for its passphrase and is unlocked in memory; a plain key never asks', async () => {
    const file = path.join(dir, 'keys', 'acme-3.pem');
    const made = await mod.generateKeyFile('acme-3', file, 'correct horse battery');
    const onDisk = await fs.readFile(file, 'utf-8');
    expect(mod.isEncryptedPem(onDisk)).toBe(true);
    expect(onDisk).not.toContain('BEGIN PRIVATE KEY');
    const encTrust: Trust = { AGENT_PUBLISHERS: [{ keyId: 'acme-3', name: 'Acme', publicKey: made.publicKey }], findPublisherByKey };

    const ask = vi.fn(async () => 'correct horse battery');
    const key = await mod.readSigningKey({ key: file }, encTrust, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith('Passphrase for acme-3.pem: ');
    expect(key).toMatchObject({ keyId: 'acme-3' });
    expect(key?.pem).toContain('BEGIN PRIVATE KEY');
    expect(mod.publicKeyOf(key!.pem)).toBe(made.publicKey);

    await expect(mod.readSigningKey({ key: file }, encTrust, async () => 'wrong')).rejects.toThrow(`Wrong passphrase for the signing key at ${file}.`);

    const plainFile = path.join(dir, 'acme-2.pem');
    await fs.writeFile(plainFile, ours.pem, 'utf-8');
    const never = vi.fn(async () => 'unused');
    expect(await mod.readSigningKey({ key: plainFile }, trust, never)).toMatchObject({ keyId: 'acme-2' });
    expect(never).not.toHaveBeenCalled();
  });
});

describe('askHidden', () => {
  /** A fake terminal: what the person types arrives as data chunks. */
  function terminal(isTTY: boolean) {
    const stdin = Object.assign(new EventEmitter(), {
      isTTY,
      raw: false,
      setRawMode(on: boolean) { this.raw = on; },
      setEncoding: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
    });
    const written: string[] = [];
    return { stdin, out: { write: (text: string) => written.push(text) }, written };
  }

  it('reads what is typed without echoing it, handles backspace, and restores the terminal', async () => {
    const t = terminal(true);
    const answer = mod.askHidden('Passphrase: ', t.stdin, t.out);
    expect(t.stdin.raw).toBe(true);
    t.stdin.emit('data', 'sx');
    t.stdin.emit('data', '\u007f');
    t.stdin.emit('data', 'ecret\r');
    await expect(answer).resolves.toBe('secret');
    expect(t.written).toEqual(['Passphrase: ', '\n']);
    expect(t.stdin.raw).toBe(false);
    expect(t.stdin.pause).toHaveBeenCalled();
    expect(t.stdin.listenerCount('data')).toBe(0);
  });

  it('Ctrl+C cancels, and without a terminal it refuses outright', async () => {
    const t = terminal(true);
    const answer = mod.askHidden('Passphrase: ', t.stdin, t.out);
    t.stdin.emit('data', 'abc\u0003');
    await expect(answer).rejects.toThrow('Cancelled.');
    expect(t.stdin.raw).toBe(false);

    const piped = terminal(false);
    await expect(mod.askHidden('Passphrase: ', piped.stdin, piped.out)).rejects.toThrow('run the command yourself in a terminal');
    expect(piped.written).toEqual([]);
  });
});

describe('agent-pack.mjs --genkey', () => {
  const env = () => {
    const e = { ...process.env };
    delete e.VIDTSX_AGENT_SIGNING_KEY;
    return e;
  };

  it('--no-passphrase writes a plain key to a file, prints only its public half, and never overwrites', async () => {
    const out = path.join(dir, 'keys', 'test-9.pem');
    const { stdout } = await run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'test-9', '--out', out, '--no-passphrase'], { env: env() });
    const pem = await fs.readFile(out, 'utf-8');
    expect(pem).toContain('BEGIN PRIVATE KEY');
    expect(stdout).not.toContain('PRIVATE KEY-----');
    expect(stdout).toContain(`private key written to ${out} (PLAIN`);
    expect(stdout).toContain(`publicKey: '${mod.publicKeyOf(pem)}'`);
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'test-9', '--out', out, '--no-passphrase'], { env: env() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('already exists'),
    });
    expect(await fs.readFile(out, 'utf-8')).toBe(pem);
  }, 60_000);

  it('by default asks for a passphrase, so without a terminal it refuses and writes nothing', async () => {
    const out = path.join(dir, 'keys', 'test-8.pem');
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', 'test-8', '--out', out], { env: env() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/run the command yourself in a terminal[\s\S]*Nothing was written/),
    });
    expect(await fs.readdir(dir)).toEqual([]);
  }, 60_000);

  it('refuses without a name, and with a name publishers.ts already uses', async () => {
    const trusted = AGENT_PUBLISHERS[0].keyId;
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--out', path.join(dir, 'a.pem')], { env: env() })).rejects.toMatchObject({
      stderr: expect.stringContaining('--genkey needs --key-id'),
    });
    await expect(run(process.execPath, [AGENT_PACK, '--genkey', '--key-id', trusted, '--out', path.join(dir, 'b.pem')], { env: env() })).rejects.toMatchObject({
      stderr: expect.stringContaining(`"${trusted}" is already a key in publishers.ts`),
    });
    expect(await fs.readdir(dir)).toEqual([]);
  }, 60_000);
});
