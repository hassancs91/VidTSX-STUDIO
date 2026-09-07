// The Stage 2 "done when": `agent-pack.mjs --check` passes on an agent folder,
// and pack → install → list round-trips (agents plan §5).
//
// This drives the REAL script in a child process rather than importing its
// pieces, because the thing worth proving is that the packer and the installer
// agree — the script bundles the app's own validator and signer out of `src/`,
// so a change that breaks that agreement has to break this test.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.0.0' },
}));

import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import { ARTIFACT_KINDS, INTERACTION_KINDS } from '../../../shared/types/agents';
import type { AgentPackageDeps } from './agent-package';
import { installAgentPackage, scanAgents, type AgentStoreRoots } from './agent-store';

const run = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'agent-pack.mjs');

let dir: string;
let source: string;
let roots: AgentStoreRoots;

const deps: AgentPackageDeps = {
  manifestContext: {
    appVersion: '1.0.0',
    toolIds: AGENT_TOOL_IDS,
    artifactKinds: ARTIFACT_KINDS,
    interactionKinds: INTERACTION_KINDS,
  },
  validateComposition: async () => ({ success: true }),
};

const AGENT_JSON = {
  formatVersion: 1,
  id: 'vidtsx/pack-test',
  name: 'Pack Test',
  version: '1.4.0',
  description: 'Exercises the packer.',
  author: { name: 'VidTSX', url: 'https://vidtsx.com' },
  license: 'MIT',
  minAppVersion: '1.0.0',
  prompt: 'AGENT.md',
  tools: ['write_document', 'ask_user'],
  sdkTools: ['WebSearch'],
  artifacts: ['document'],
  interactions: ['form'],
  starter: {
    entry: 'brief',
    nodes: { brief: { question: 'About what?', text: true, next: '$end' } },
    opening: 'Write about: {{brief}}',
  },
};

async function writeSourceFolder(manifest: Record<string, unknown> = AGENT_JSON): Promise<void> {
  await fs.mkdir(path.join(source, 'skills', 'tone'), { recursive: true });
  await fs.mkdir(path.join(source, 'assets'), { recursive: true });
  await fs.writeFile(path.join(source, 'agent.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(source, 'AGENT.md'), '# Pack Test\n\nWrite documents.\n');
  await fs.writeFile(path.join(source, 'skills', 'tone', 'SKILL.md'), '# Tone\n\nBe brief.\n');
  await fs.writeFile(
    path.join(source, 'assets', 'template.tsx'),
    'export const compositionConfig = { id: "a", durationInFrames: 60, fps: 30, width: 1080, height: 1920 };\n',
  );
  // A dotfile the packer must leave out of files[] entirely.
  await fs.writeFile(path.join(source, '.DS_Store'), 'junk');
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-pack-'));
  source = path.join(dir, 'src-agent');
  roots = { userDir: path.join(dir, 'user'), builtinDir: path.join(dir, 'builtin') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('agent-pack.mjs', () => {
  it('checks a well-formed folder without writing anything', async () => {
    await writeSourceFolder();
    const { stdout } = await run(process.execPath, [SCRIPT, source, '--check']);
    expect(stdout).toContain('vidtsx/pack-test 1.4.0');
    // AGENT.md + the skill + the asset. `agent.json` describes the list rather
    // than appearing in it, and the dotfile is never packed.
    expect(stdout).toContain('3 files');
    expect(stdout).toContain('nothing written');
    expect(await fs.readdir(dir)).toEqual(['src-agent']);
  }, 60_000);

  it('reports every manifest problem at once, and exits non-zero', async () => {
    await writeSourceFolder({
      ...AGENT_JSON,
      tools: ['launch_missiles'],
      sdkTools: ['Bash'],
      minAppVersion: '9.9.9',
    });
    await expect(run(process.execPath, [SCRIPT, source, '--check'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('launch_missiles'),
    });

    const err = await run(process.execPath, [SCRIPT, source, '--check']).catch(
      (e: { stderr: string }) => e,
    );
    expect(err.stderr).toContain('Bash');
    expect(err.stderr).toContain('needs VidTSX 9.9.9');
  }, 60_000);

  it('packs, signs, installs and lists — the round trip', async () => {
    await writeSourceFolder();
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const keyFile = path.join(dir, 'signing.pem');
    await fs.writeFile(keyFile, privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());

    const out = path.join(dir, 'vidtsx.pack-test.vidtsxagent');
    const { stdout } = await run(process.execPath, [
      SCRIPT,
      source,
      '--out',
      out,
      '--key',
      keyFile,
      '--key-id',
      'vidtsx-1',
    ]);
    expect(stdout).toContain('signed as vidtsx-1');

    const signedDeps: AgentPackageDeps = {
      ...deps,
      publishers: [
        {
          keyId: 'vidtsx-1',
          name: 'VidTSX',
          publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
        },
      ],
    };
    const installed = await installAgentPackage(out, signedDeps, {}, roots);
    expect(installed.agent).toMatchObject({
      origin: 'user',
      signature: 'verified',
      keyId: 'vidtsx-1',
      manifest: { id: 'vidtsx/pack-test', version: '1.4.0' },
    });

    // Everything the folder shipped is on disk, and the dotfile is not.
    const folder = path.join(roots.userDir, 'vidtsx', 'pack-test');
    expect(await fs.readFile(path.join(folder, 'skills/tone/SKILL.md'), 'utf-8')).toContain('Tone');
    await expect(fs.stat(path.join(folder, '.DS_Store'))).rejects.toThrow();

    const listed = await scanAgents(signedDeps, roots);
    expect(listed.map((a) => `${a.manifest.id}@${a.manifest.version}`)).toEqual([
      'vidtsx/pack-test@1.4.0',
    ]);
    expect(listed[0].signature).toBe('verified');
  }, 60_000);

  it('packs unsigned when no key is given, and the package still installs', async () => {
    await writeSourceFolder();
    const out = path.join(dir, 'unsigned.vidtsxagent');
    const env = { ...process.env };
    delete env.VIDTSX_AGENT_SIGNING_KEY;
    const { stdout } = await run(process.execPath, [SCRIPT, source, '--out', out], { env });
    expect(stdout).toContain('UNSIGNED');

    const installed = await installAgentPackage(out, deps, {}, roots);
    expect(installed.agent?.signature).toBe('unsigned');
  }, 60_000);
});
