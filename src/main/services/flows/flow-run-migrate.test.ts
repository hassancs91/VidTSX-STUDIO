// Stage 1's run folders (`<assets>/flows/<flowId>/runs/<runId>`) move to
// `<userData>/flows-runs/<flowId>/<runId>` once (W8 Stage 6); media folders
// beside them are untouched, an occupied target is skipped, empty shells go.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { migrateLegacyRunFolders } from './flow-run-migrate';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-runs-migrate-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('migrateLegacyRunFolders', () => {
  it('moves every run folder, leaves media folders alone, removes the empty shells', async () => {
    const legacy = path.join(dir, 'assets', 'flows');
    const runsRoot = path.join(dir, 'flows-runs');
    await fs.mkdir(path.join(legacy, '01ULID', 'runs', 'r1', 'files'), { recursive: true });
    await fs.writeFile(path.join(legacy, '01ULID', 'runs', 'r1', 'run.json'), '{"id":"r1"}');
    await fs.mkdir(path.join(legacy, '01ULID', 'runs', 'r2'), { recursive: true });
    await fs.mkdir(path.join(legacy, 'my-flow'), { recursive: true });
    await fs.writeFile(path.join(legacy, 'my-flow', 'image.png'), 'png');

    const result = await migrateLegacyRunFolders(legacy, runsRoot);
    expect(result).toEqual({ moved: 2, skipped: 0 });
    expect(await fs.readFile(path.join(runsRoot, '01ULID', 'r1', 'run.json'), 'utf-8')).toBe('{"id":"r1"}');
    expect(await exists(path.join(runsRoot, '01ULID', 'r2'))).toBe(true);
    expect(await exists(path.join(legacy, '01ULID'))).toBe(false);
    expect(await exists(path.join(legacy, 'my-flow', 'image.png'))).toBe(true);
  });

  it('skips a run whose target exists and is a no-op on a missing legacy root', async () => {
    const legacy = path.join(dir, 'assets', 'flows');
    const runsRoot = path.join(dir, 'flows-runs');
    await fs.mkdir(path.join(legacy, 'F', 'runs', 'r1'), { recursive: true });
    await fs.writeFile(path.join(legacy, 'F', 'runs', 'r1', 'run.json'), 'old');
    await fs.mkdir(path.join(runsRoot, 'F', 'r1'), { recursive: true });
    await fs.writeFile(path.join(runsRoot, 'F', 'r1', 'run.json'), 'new');

    expect(await migrateLegacyRunFolders(legacy, runsRoot)).toEqual({ moved: 0, skipped: 1 });
    expect(await fs.readFile(path.join(runsRoot, 'F', 'r1', 'run.json'), 'utf-8')).toBe('new');
    expect(await exists(path.join(legacy, 'F', 'runs', 'r1'))).toBe(true);

    expect(await migrateLegacyRunFolders(path.join(dir, 'nowhere'), runsRoot)).toEqual({ moved: 0, skipped: 0 });
  });
});
