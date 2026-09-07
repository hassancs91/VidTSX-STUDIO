import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AgentArtifactStore, assertContainedRelPath } from './artifact-store';

let dir: string;
const producer = { tool: 'write_document', callId: 'call-1' };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-artifacts-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('assertContainedRelPath', () => {
  it('accepts ordinary relative paths', () => {
    expect(() => assertContainedRelPath('documents/script.md', 'x')).not.toThrow();
  });

  it('rejects absolute, drive-lettered, UNC and dot-dot paths', () => {
    for (const bad of ['/etc/passwd', 'C:\\Windows\\x', '\\\\server\\share', '../secrets/k']) {
      expect(() => assertContainedRelPath(bad, 'x')).toThrow();
    }
  });

  it('rejects empty and untrimmed paths', () => {
    expect(() => assertContainedRelPath('', 'x')).toThrow();
    expect(() => assertContainedRelPath(' a.md', 'x')).toThrow();
    expect(() => assertContainedRelPath('a//b.md', 'x')).toThrow();
  });
});

describe('AgentArtifactStore', () => {
  it('assigns id, createdAt, producer and version, and persists', async () => {
    const store = await AgentArtifactStore.open(dir);
    const doc = await store.add(
      { kind: 'document', title: 'Script', payload: { relPath: 'documents/script.md' } },
      producer,
    );
    expect(doc.id).toBe('document-1');
    expect(doc.version).toBe(1);
    expect(doc.producer).toEqual(producer);
    expect(Date.parse(doc.createdAt)).not.toBeNaN();

    const reopened = await AgentArtifactStore.open(dir);
    expect(reopened.list().map((a) => a.id)).toEqual(['document-1']);
  });

  it('numbers ids over one session-wide sequence and continues after a reload', async () => {
    const store = await AgentArtifactStore.open(dir);
    await store.add(
      { kind: 'document', title: 'A', payload: { relPath: 'a.md' } },
      producer,
    );
    await store.add(
      {
        kind: 'composition',
        title: 'B',
        payload: {
          relPath: 'compositions/b.tsx',
          config: { id: 'main', durationInFrames: 90, fps: 30, width: 1080, height: 1920 },
        },
      },
      producer,
    );
    const reopened = await AgentArtifactStore.open(dir);
    const next = await reopened.add(
      { kind: 'document', title: 'C', payload: { relPath: 'c.md' } },
      producer,
    );
    expect(next.id).toBe('document-3');
  });

  it('carries the version forward when a draft supersedes another', async () => {
    const store = await AgentArtifactStore.open(dir);
    const config = { id: 'main', durationInFrames: 90, fps: 30, width: 1080, height: 1920 };
    const first = await store.add(
      { kind: 'composition', title: 'Post', payload: { relPath: 'compositions/p.tsx', config } },
      producer,
    );
    const second = await store.add(
      { kind: 'composition', title: 'Post', payload: { relPath: 'compositions/p-2.tsx', config } },
      producer,
      { supersedes: first.id },
    );
    expect(second.version).toBe(2);
    expect(store.get(first.id)?.version).toBe(1);
    await expect(
      store.add(
        { kind: 'document', title: 'X', payload: { relPath: 'x.md' } },
        producer,
        { supersedes: 'composition-99' },
      ),
    ).rejects.toThrow(/unknown artifact/i);
  });

  it('refuses a draft whose relPath escapes the session', async () => {
    const store = await AgentArtifactStore.open(dir);
    await expect(
      store.add(
        { kind: 'document', title: 'Bad', payload: { relPath: '../../escape.md' } },
        producer,
      ),
    ).rejects.toThrow(/".."/);
    await expect(
      store.add(
        {
          kind: 'image-set',
          title: 'Bad',
          payload: { items: [{ relPath: '/abs/x.png', width: 1, height: 1 }] },
        },
        producer,
      ),
    ).rejects.toThrow(/relative/);
    expect(store.list()).toHaveLength(0);
  });

  it('patches a job payload to its terminal state', async () => {
    const store = await AgentArtifactStore.open(dir);
    const job = await store.add(
      {
        kind: 'job',
        title: 'Render',
        payload: { jobId: 'j1', job: 'render', status: 'pending' },
      },
      producer,
    );
    const done = await store.patchPayload(job.id, {
      status: 'completed',
      resultArtifactId: 'video-2',
    });
    expect(done.payload).toMatchObject({
      jobId: 'j1',
      status: 'completed',
      resultArtifactId: 'video-2',
    });
  });

  it('hands out copies, so a caller cannot mutate the store', async () => {
    const store = await AgentArtifactStore.open(dir);
    const doc = await store.add(
      { kind: 'document', title: 'Script', payload: { relPath: 'a.md' } },
      producer,
    );
    const copy = store.get(doc.id);
    if (copy) copy.title = 'tampered';
    expect(store.get(doc.id)?.title).toBe('Script');
    const listed = store.list();
    listed[0].title = 'tampered too';
    expect(store.list()[0].title).toBe('Script');
  });

  it('sets a corrupt file aside rather than deleting it', async () => {
    await fs.writeFile(path.join(dir, 'artifacts.json'), '{ not json', 'utf-8');
    const store = await AgentArtifactStore.open(dir);
    expect(store.list()).toEqual([]);
    const files = await fs.readdir(dir);
    expect(files.some((f) => f.includes('corrupt'))).toBe(true);
  });
});
