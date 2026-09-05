import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'http';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { DownloadProgress, DownloadTaskState } from './types';

// Persistence goes through better-sqlite3 + electron's app paths — stub it out
// so the engine can run in a plain Node test environment.
let restoredState: DownloadTaskState[] = [];
vi.mock('./download-state', () => ({
  loadDownloadState: async () => restoredState,
  saveDownloadState: () => {},
  flushDownloadState: async () => {},
}));

import { enqueueDownload, onDownloadProgress, restoreDownloads } from './download-engine';

const FILE_BODY = 'x'.repeat(64 * 1024);

let server: http.Server;
let baseUrl: string;
let tmpDir: string;
let rangeRequests: string[] = [];

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-engine-test-'));
  // Range-aware server, mimicking HuggingFace/CDN resume semantics
  server = http.createServer((req, res) => {
    // A dead primary host for the mirror-fallback test: 404, never retried.
    if (req.url?.startsWith('/gone/')) {
      res.writeHead(404);
      res.end('not here');
      return;
    }
    const range = req.headers.range;
    if (range) rangeRequests.push(range);
    const total = FILE_BODY.length;

    if (range) {
      const start = parseInt(range.replace('bytes=', '').split('-')[0], 10);
      if (start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${total - 1}/${total}`,
        'Content-Length': String(total - start),
      });
      res.end(FILE_BODY.slice(start));
      return;
    }

    res.writeHead(200, { 'Content-Length': String(total) });
    res.end(FILE_BODY);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('download engine finalizePath', () => {
  it('renames the temp file to finalizePath before emitting completed', async () => {
    const finalPath = path.join(tmpDir, 'model.bin');
    const partPath = `${finalPath}.part`;

    // Snapshot file state at the exact moment the completed event is emitted —
    // this is what a renderer-triggered folder rescan would observe.
    let atCompleted: { finalExists: boolean; partExists: boolean } | null = null;
    const unsub = onDownloadProgress((p: DownloadProgress) => {
      if (p.id === 'test-finalize' && p.status === 'completed') {
        atCompleted = {
          finalExists: existsSync(finalPath),
          partExists: existsSync(partPath),
        };
      }
    });

    try {
      await enqueueDownload({
        id: 'test-finalize',
        url: `${baseUrl}/model.bin`,
        destPath: partPath,
        finalizePath: finalPath,
      });
    } finally {
      unsub();
    }

    expect(atCompleted).toEqual({ finalExists: true, partExists: false });
    expect(await fs.readFile(finalPath, 'utf8')).toBe(FILE_BODY);
  });

  it('fails instead of completing when finalization is impossible', async () => {
    const partPath = path.join(tmpDir, 'broken.bin.part');
    const finalPath = path.join(tmpDir, 'no-such-dir', 'broken.bin');

    let sawCompleted = false;
    let sawFailed = false;
    const unsub = onDownloadProgress((p: DownloadProgress) => {
      if (p.id !== 'test-finalize-fail') return;
      if (p.status === 'completed') sawCompleted = true;
      if (p.status === 'failed') sawFailed = true;
    });

    try {
      await expect(
        enqueueDownload({
          id: 'test-finalize-fail',
          url: `${baseUrl}/broken.bin`,
          destPath: partPath,
          finalizePath: finalPath,
        }),
      ).rejects.toThrow();
    } finally {
      unsub();
    }

    expect(sawCompleted).toBe(false);
    expect(sawFailed).toBe(true);
  });

  it('completes normally without finalizePath (legacy behavior)', async () => {
    const destPath = path.join(tmpDir, 'plain.bin');

    await enqueueDownload({
      id: 'test-plain',
      url: `${baseUrl}/plain.bin`,
      destPath,
    });

    expect(await fs.readFile(destPath, 'utf8')).toBe(FILE_BODY);
  });
});

describe('resuming from existing .part files', () => {
  it('resumes a partial .part via Range instead of starting from scratch', async () => {
    const finalPath = path.join(tmpDir, 'resume.bin');
    const partPath = `${finalPath}.part`;
    const half = FILE_BODY.length / 2;
    await fs.writeFile(partPath, FILE_BODY.slice(0, half));
    rangeRequests = [];

    await enqueueDownload({
      id: 'test-resume-partial',
      url: `${baseUrl}/resume.bin`,
      destPath: partPath,
      finalizePath: finalPath,
    });

    expect(rangeRequests).toContain(`bytes=${half}-`);
    expect(await fs.readFile(finalPath, 'utf8')).toBe(FILE_BODY);
  });

  it('completes and finalizes immediately when the .part already holds the full file (HTTP 416)', async () => {
    const finalPath = path.join(tmpDir, 'already-done.bin');
    const partPath = `${finalPath}.part`;
    await fs.writeFile(partPath, FILE_BODY);

    await enqueueDownload({
      id: 'test-resume-complete',
      url: `${baseUrl}/already-done.bin`,
      destPath: partPath,
      finalizePath: finalPath,
    });

    expect(existsSync(partPath)).toBe(false);
    expect(await fs.readFile(finalPath, 'utf8')).toBe(FILE_BODY);
  });
});

describe('restoreDownloads startup heal', () => {
  it('finalizes a completed-but-unrenamed .part left by an older version', async () => {
    const finalPath = path.join(tmpDir, 'orphan.gguf');
    const partPath = `${finalPath}.part`;
    await fs.writeFile(partPath, FILE_BODY);

    // Legacy row: no finalizePath (the rename used to live outside the engine)
    restoredState = [
      {
        options: {
          id: 'sdimage-model-orphan',
          url: `${baseUrl}/orphan.gguf`,
          destPath: partPath,
          metadata: { modelId: 'orphan', type: 'sdimage-model' },
        },
        status: 'completed',
        downloadedBytes: FILE_BODY.length,
        totalBytes: FILE_BODY.length,
        updatedAt: new Date().toISOString(),
        retryCount: 0,
      },
    ];

    await restoreDownloads();

    expect(existsSync(partPath)).toBe(false);
    expect(await fs.readFile(finalPath, 'utf8')).toBe(FILE_BODY);
  });
});

describe('mirror fallback', () => {
  it('switches to the next mirror when the primary URL fails for good (404)', async () => {
    const destPath = path.join(tmpDir, 'mirrored.bin');
    const statuses: string[] = [];
    const unsub = onDownloadProgress((p: DownloadProgress) => {
      if (p.id === 'test-mirror') statuses.push(p.status);
    });
    try {
      await enqueueDownload({
        id: 'test-mirror',
        url: `${baseUrl}/gone/mirrored.bin`,
        mirrors: [`${baseUrl}/gone/still-gone.bin`, `${baseUrl}/mirrored.bin`],
        destPath,
      });
    } finally {
      unsub();
    }
    expect(await fs.readFile(destPath, 'utf8')).toBe(FILE_BODY);
    expect(statuses).not.toContain('failed');
    expect(statuses[statuses.length - 1]).toBe('completed');
  });

  it('still fails when every mirror is dead', async () => {
    const destPath = path.join(tmpDir, 'never.bin');
    await expect(
      enqueueDownload({
        id: 'test-mirror-dead',
        url: `${baseUrl}/gone/a.bin`,
        mirrors: [`${baseUrl}/gone/b.bin`],
        destPath,
      }),
    ).rejects.toThrow(/HTTP error: 404/);
  });
});
