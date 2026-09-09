import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// preset-store → library-paths → settings-db → electron; CRUD never touches
// settings (root is explicit), so a bare app stub is enough (brand-store
// test pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import type { StudioPresetInput } from '../../../shared/studio/preset';
import {
  applyPresetLearning,
  createPreset,
  deletePreset,
  listPresets,
  readPreset,
  readPresetSkills,
  updatePreset,
} from './preset-store';
import { ensureBuiltinPresets } from './preset-builtins';

let root = '';

const INPUT: StudioPresetInput = {
  name: 'My Shorts',
  description: 'Vertical, tight.',
  videoKind: 'short',
  orientation: '9:16',
  workflow: [{ id: 'transcribe' }, { id: 'auto_cut', aggressiveness: 'aggressive' }, { id: 'captions', template: 'core/word-pop' }],
  style: { pacing: 'tight', shotsPerMinute: 4, captions: 'karaoke' },
  body: '# My shorts\r\n\r\nHook first.  \n',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-preset-test-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(root, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('preset-store CRUD at presets/<slug>/', () => {
  it('createPreset slugs the name into the folder id and writes preset.json + PRESET.md', async () => {
    const preset = await createPreset(root, INPUT);
    expect(preset.id).toBe('my-shorts');
    expect(preset.body).toBe('# My shorts\n\nHook first.');
    const onDisk = JSON.parse(await fs.readFile(path.join(root, 'presets', 'my-shorts', 'preset.json'), 'utf-8'));
    expect(onDisk.name).toBe('My Shorts');
    expect(onDisk.workflow[1]).toEqual({ id: 'auto_cut', aggressiveness: 'aggressive' });
    expect('body' in onDisk).toBe(false); // the body is PRESET.md, never in the json
    expect(await fs.readFile(path.join(root, 'presets', 'my-shorts', 'PRESET.md'), 'utf-8')).toBe('# My shorts\n\nHook first.');
  });

  it('a name collision reserves -2 instead of overwriting', async () => {
    const preset = await createPreset(root, INPUT);
    expect(preset.id).toBe('my-shorts-2');
    expect(await readPreset(root, 'my-shorts')).not.toBeNull();
  });

  it('createPreset refuses invalid input', async () => {
    await expect(createPreset(root, { ...INPUT, name: 'x' })).rejects.toThrow(/at least 2 characters/);
  });

  it('readPreset returns null for missing, corrupt and traversal ids', async () => {
    expect(await readPreset(root, 'nope')).toBeNull();
    await fs.mkdir(path.join(root, 'presets', 'broken'), { recursive: true });
    await fs.writeFile(path.join(root, 'presets', 'broken', 'preset.json'), '{not json', 'utf-8');
    expect(await readPreset(root, 'broken')).toBeNull();
    expect(await readPreset(root, '../my-shorts')).toBeNull();
  });

  it('a missing PRESET.md reads as an empty body, not a broken preset', async () => {
    await fs.mkdir(path.join(root, 'presets', 'bare'), { recursive: true });
    await fs.writeFile(path.join(root, 'presets', 'bare', 'preset.json'), JSON.stringify({ name: 'Bare' }), 'utf-8');
    const preset = await readPreset(root, 'bare');
    expect(preset?.name).toBe('Bare');
    expect(preset?.body).toBe('');
  });

  it('listPresets skips the broken folder, ignores dot-folders and sorts by name', async () => {
    await fs.mkdir(path.join(root, 'presets', '.hidden'), { recursive: true });
    const presets = await listPresets(root);
    expect(presets.map((p) => p.id)).toEqual(['bare', 'my-shorts', 'my-shorts-2']);
  });

  it('updatePreset keeps id and createdAt, replaces knobs and body', async () => {
    const before = await readPreset(root, 'my-shorts');
    const updated = await updatePreset(root, 'my-shorts', {
      ...INPUT,
      name: 'My Shorts v2',
      style: { pacing: 'normal' },
      workflow: [{ id: 'editorial' }],
      body: 'New body',
    });
    expect(updated.id).toBe('my-shorts');
    expect(updated.createdAt).toBe(before?.createdAt);
    expect(updated.name).toBe('My Shorts v2');
    expect(updated.style).toEqual({ pacing: 'normal' });
    expect(updated.workflow).toEqual([{ id: 'editorial' }]);
    expect((await readPreset(root, 'my-shorts'))?.body).toBe('New body');
  });

  it('updatePreset throws for a missing preset', async () => {
    await expect(updatePreset(root, 'ghost', INPUT)).rejects.toThrow(/Preset not found/);
  });

  it('applyPresetLearning patches knobs, appends the section and logs the entry', async () => {
    const learned = await applyPresetLearning(root, 'my-shorts', {
      style: { pacing: 'tight', shotsPerMinute: 6 },
      bodyAppend: '## Learned from Demo on 2026-09-09\n\n- Cuts ran at 12/min.',
      learned: { projectId: 'demo', at: '2026-09-09T10:00:00.000Z', summary: 'Tighter than the preset.' },
    });
    expect(learned.style).toEqual({ pacing: 'tight', shotsPerMinute: 6 });
    expect(learned.body).toBe('New body\n\n## Learned from Demo on 2026-09-09\n\n- Cuts ran at 12/min.');
    expect(learned.learned).toEqual([{ projectId: 'demo', at: '2026-09-09T10:00:00.000Z', summary: 'Tighter than the preset.' }]);
    expect(learned.workflow).toEqual([{ id: 'editorial' }]); // untouched
    expect(learned.updatedAt).toBe('2026-09-09T10:00:00.000Z');
  });

  it('readPresetSkills reads skills/<id>/SKILL.md in the folder format', async () => {
    const skillDir = path.join(root, 'presets', 'my-shorts', 'skills', 'hook');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: Hook\ndescription: The hook rule\n---\n\nHook first.', 'utf-8');
    const skills = await readPresetSkills(root, 'my-shorts');
    expect(skills).toEqual([{ id: 'hook', name: 'Hook', description: 'The hook rule', body: 'Hook first.' }]);
    expect(await readPresetSkills(root, 'bare')).toEqual([]);
  });

  it('deletePreset removes the whole folder, skills included', async () => {
    await deletePreset(root, 'my-shorts');
    expect(await readPreset(root, 'my-shorts')).toBeNull();
    await expect(fs.access(path.join(root, 'presets', 'my-shorts'))).rejects.toThrow();
  });
});

describe('ensureBuiltinPresets', () => {
  const builtinDir = path.resolve(__dirname, '../../../../resources/presets');

  it('copies the three shipped presets once and records them in the ledger', async () => {
    const seededRoot = path.join(tmpDir, 'seeded');
    await fs.mkdir(seededRoot, { recursive: true });
    const first = await ensureBuiltinPresets(seededRoot, builtinDir);
    expect(first.sort()).toEqual(['course-lesson', 'talking-head-short', 'youtube-long-form']);
    const presets = await listPresets(seededRoot);
    expect(presets.map((p) => p.id).sort()).toEqual(['course-lesson', 'talking-head-short', 'youtube-long-form']);
    for (const preset of presets) {
      expect(preset.body.length).toBeGreaterThan(500);
      expect(preset.workflow.length).toBeGreaterThan(3);
      expect(preset.workflow[0]).toEqual({ id: 'transcribe' });
    }
    expect(await ensureBuiltinPresets(seededRoot, builtinDir)).toEqual([]);
  });

  it('a deleted built-in stays deleted on the next seeding', async () => {
    const seededRoot = path.join(tmpDir, 'seeded');
    await deletePreset(seededRoot, 'course-lesson');
    expect(await ensureBuiltinPresets(seededRoot, builtinDir)).toEqual([]);
    expect(await readPreset(seededRoot, 'course-lesson')).toBeNull();
  });

  it('a user copy that already exists is never overwritten', async () => {
    const userRoot = path.join(tmpDir, 'user');
    await fs.mkdir(path.join(userRoot, 'presets', 'talking-head-short'), { recursive: true });
    await fs.writeFile(path.join(userRoot, 'presets', 'talking-head-short', 'preset.json'), JSON.stringify({ name: 'Mine' }), 'utf-8');
    const seeded = await ensureBuiltinPresets(userRoot, builtinDir);
    expect(seeded.sort()).toEqual(['course-lesson', 'youtube-long-form']);
    expect((await readPreset(userRoot, 'talking-head-short'))?.name).toBe('Mine');
  });

  it('a missing resources folder seeds nothing and does not throw', async () => {
    expect(await ensureBuiltinPresets(path.join(tmpDir, 'empty'), path.join(tmpDir, 'no-such-dir'))).toEqual([]);
  });
});
