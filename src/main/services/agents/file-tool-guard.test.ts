import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createFileToolGuard } from './file-tool-guard';

let root: string;
let workspace: string;
let outside: string;
let guard: ReturnType<typeof createFileToolGuard>;
/** Set when the platform let us make a symlink (Windows needs privilege). */
let symlinked = false;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-guard-'));
  workspace = path.join(root, 'workspace');
  outside = path.join(root, 'secrets');
  await fs.mkdir(path.join(workspace, 'documents'), { recursive: true });
  await fs.mkdir(outside, { recursive: true });
  await fs.writeFile(path.join(workspace, 'documents', 'script.md'), '# hi', 'utf-8');
  await fs.writeFile(path.join(outside, 'keys.txt'), 'secret', 'utf-8');
  try {
    await fs.symlink(outside, path.join(workspace, 'escape'), 'dir');
    symlinked = true;
  } catch {
    symlinked = false; // Unprivileged Windows — the other rows still hold.
  }
  guard = createFileToolGuard(workspace);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('file-tool guard', () => {
  it('allows a relative path inside the workspace', async () => {
    const decision = await guard('Read', { file_path: 'documents/script.md' });
    expect(decision.behavior).toBe('allow');
  });

  it('allows an absolute path inside the workspace', async () => {
    const decision = await guard('Write', {
      file_path: path.join(workspace, 'documents', 'new.md'),
    });
    expect(decision.behavior).toBe('allow');
  });

  it('denies a path that climbs out with ..', async () => {
    const decision = await guard('Read', { file_path: '../secrets/keys.txt' });
    expect(decision).toMatchObject({ behavior: 'deny' });
    if (decision.behavior === 'deny') {
      expect(decision.message).toContain('outside your session folder');
    }
  });

  it('denies an absolute path outside the workspace', async () => {
    const decision = await guard('Read', { file_path: path.join(outside, 'keys.txt') });
    expect(decision.behavior).toBe('deny');
  });

  it('denies a symlink that points outside', async () => {
    if (!symlinked) return;
    const decision = await guard('Read', { file_path: 'escape/keys.txt' });
    expect(decision.behavior).toBe('deny');
  });

  it('checks a Glob root, not just its pattern', async () => {
    expect((await guard('Glob', { pattern: '**/*.md', path: '..' })).behavior).toBe('deny');
    expect((await guard('Glob', { pattern: '**/*.md' })).behavior).toBe('allow');
    expect((await guard('Glob', { pattern: '**/*.md', path: 'documents' })).behavior).toBe('allow');
  });

  it('checks a Grep root the same way', async () => {
    expect((await guard('Grep', { pattern: 'x', path: outside })).behavior).toBe('deny');
    expect((await guard('Grep', { pattern: 'x', path: '.' })).behavior).toBe('allow');
  });

  it('lets the network tools through untouched', async () => {
    expect((await guard('WebSearch', { query: 'remotion easing' })).behavior).toBe('allow');
    expect((await guard('WebFetch', { url: 'https://example.com' })).behavior).toBe('allow');
  });

  it('denies every other tool name, Bash above all', async () => {
    for (const name of ['Bash', 'Task', 'NotebookEdit', 'KillShell']) {
      const decision = await guard(name, {});
      expect(decision).toMatchObject({ behavior: 'deny' });
    }
  });

  it('denies a path argument that is not a string', async () => {
    expect((await guard('Read', { file_path: 42 })).behavior).toBe('deny');
    expect((await guard('Read', { file_path: '  ' })).behavior).toBe('deny');
  });
});
