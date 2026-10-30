// The join_clips render entry: the shared composition behind the `@shared`
// alias, the plan and the clip URLs baked in, written under the app root (where
// `remotion` resolves) and removed by `cleanup`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let root = '';
vi.mock('../../utils/paths', () => ({ getAppRoot: () => root }));

const { createJoinEntry, joinEntrySource, JOIN_COMPOSITION_ID } = await import('./join-entry');
const { planJoin } = await import('../../../shared/media/join-plan');

const plan = planJoin(
  [
    { duration: 241 / 24, width: 1080, height: 1920, fps: 24, hasAudio: false },
    { duration: 145 / 24, width: 1080, height: 1920, fps: 24, hasAudio: false },
  ],
  { transition: 'dip-to-black', fadeOutSeconds: 0.25, fadeInSeconds: 0.3, fit: 'cover' },
);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'join-entry-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('join entry', () => {
  it('registers the shared composition with the plan, the URLs and the plan\'s size and length', () => {
    const source = joinEntrySource(plan, ['http://127.0.0.1:3100/asset?path=a.mp4']);
    expect(source).toContain("import { JoinClipsComposition } from '@shared/media/JoinClipsComposition';");
    expect(source).toContain(`const PLAN = ${JSON.stringify(plan)};`);
    expect(source).toContain('const SOURCES = ["http://127.0.0.1:3100/asset?path=a.mp4"];');
    expect(source).toContain(`id=${JSON.stringify(JOIN_COMPOSITION_ID)}`);
    expect(source).toContain('durationInFrames={PLAN.durationInFrames}');
    expect(source).toContain('registerRoot(Root);');
  });

  it('hands the plan to the composition by closure, never through defaultProps', () => {
    // The in-main renderer passes a manual composition object whose props are
    // the (absent) input props, so defaultProps never arrive — the first live
    // run failed on `plan` undefined.
    const source = joinEntrySource(plan, []);
    expect(source).toContain('const Joined = () => <JoinClipsComposition plan={PLAN} sources={SOURCES} />;');
    expect(source).toContain('component={Joined}');
    expect(source).not.toContain('defaultProps');
  });

  it('writes the entry under <appRoot>/.vidtsx-temp/joins with the clips on the asset route, and cleanup removes it', async () => {
    const clip = path.join('C:', 'lib', 'flows', 'staging clip.mp4');
    const entry = await createJoinEntry(plan, [clip], 4123);
    expect(path.dirname(entry.entryPath)).toBe(path.join(root, '.vidtsx-temp', 'joins'));
    const written = await fs.readFile(entry.entryPath, 'utf-8');
    expect(written).toContain(`http://127.0.0.1:4123/asset?path=${encodeURIComponent(clip)}`);
    await entry.cleanup();
    await expect(fs.stat(entry.entryPath)).rejects.toThrow();
    await entry.cleanup(); // a second cleanup is quiet
  });
});
