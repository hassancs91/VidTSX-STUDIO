import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProject } from '../../../shared/types/studio';
import type { StudioPresetEntry, StudioPresetStyle } from '../../../shared/types/studio-preset';
import { cutStyleKey } from '../../../shared/studio/cut-style-resolve';

const env = vi.hoisted(() => ({
  skillsDir: '',
  project: null as StudioProject | null,
  presets: new Map<string, StudioPresetEntry>(),
}));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
vi.mock('../../utils/paths', () => ({ getSkillsDir: () => env.skillsDir }));
vi.mock('../library/library-paths', () => ({ getLibraryRoot: () => 'root' }));
vi.mock('../library/preset-store', () => ({
  readPreset: async (_root: string, id: string) => env.presets.get(id) ?? null,
}));
vi.mock('./project-store', () => ({
  loadProject: async () => {
    if (!env.project) throw new Error('no project on disk');
    return env.project;
  },
}));

import {
  cutStyleFilePath,
  loadCutStyleFile,
  resetCutStyleCache,
  resolveProjectCutStyle,
} from './cut-style-store';

const SHIPPED_SKILLS = path.resolve(process.cwd(), 'resources/skills');

function project(settings: Partial<StudioProject['settings']> = {}): StudioProject {
  return { settings: { width: 1920, height: 1080, fps: 30, agent: {}, ...settings } } as StudioProject;
}

function preset(id: string, style: StudioPresetStyle, name = 'Shorts'): StudioPresetEntry {
  return { id, name, style } as StudioPresetEntry;
}

beforeEach(() => {
  env.skillsDir = SHIPPED_SKILLS;
  env.project = project();
  env.presets.clear();
  resetCutStyleCache();
});

describe('loadCutStyleFile', () => {
  it('reads the shipped file beside the clean-cut skill', async () => {
    expect(cutStyleFilePath()).toBe(path.join(SHIPPED_SKILLS, 'studio-clean-cut', 'cut-style.json'));
    const file = await loadCutStyleFile();
    expect(file.default).toBe('tight');
    expect(Object.keys(file.styles).sort()).toEqual(['natural', 'relaxed', 'tight']);
  });

  it('parses once per run (a later move of the folder does not matter)', async () => {
    const first = await loadCutStyleFile();
    env.skillsDir = path.join(os.tmpdir(), 'no-such-skills-dir');
    expect(await loadCutStyleFile()).toBe(first);
  });

  describe('a missing or broken file', () => {
    let dir = '';
    afterEach(async () => {
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    });

    it('throws naming the path, and a later call retries', async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cut-style-store-'));
      env.skillsDir = dir;
      await expect(loadCutStyleFile()).rejects.toThrow(/default cut style is missing/);
      await fs.mkdir(path.join(dir, 'studio-clean-cut'));
      await fs.writeFile(path.join(dir, 'studio-clean-cut', 'cut-style.json'), '{ nope', 'utf-8');
      await expect(loadCutStyleFile()).rejects.toThrow(/not valid JSON/);
      await fs.copyFile(
        path.join(SHIPPED_SKILLS, 'studio-clean-cut', 'cut-style.json'),
        path.join(dir, 'studio-clean-cut', 'cut-style.json'),
      );
      expect((await loadCutStyleFile()).default).toBe('tight');
    });
  });
});

describe('resolveProjectCutStyle', () => {
  it('no preset, no override → the file default (tight)', async () => {
    const file = await loadCutStyleFile();
    const r = await resolveProjectCutStyle('p1');
    expect(r).toMatchObject({ styleName: 'tight', source: 'default', displayName: 'tight · default' });
    expect(r.key).toBe(cutStyleKey(file.styles.tight));
  });

  it("reads the project's preset by settings.presetId (pacing maps)", async () => {
    env.presets.set('shorts', preset('shorts', { pacing: 'normal' }));
    env.project = project({ presetId: 'shorts' });
    const r = await resolveProjectCutStyle('p1');
    expect(r).toMatchObject({ styleName: 'natural', source: 'pacing', displayName: 'natural · preset “Shorts”' });
  });

  it('a stale preset id resolves as no preset', async () => {
    env.project = project({ presetId: 'ghost' });
    expect(await resolveProjectCutStyle('p1')).toMatchObject({ styleName: 'tight', source: 'default' });
  });

  it("the project's cutStyle override beats the preset", async () => {
    env.presets.set('shorts', preset('shorts', { cut: { base: 'natural', head: 0.25 } }));
    env.project = project({ presetId: 'shorts', cutStyle: { base: 'relaxed' } });
    const r = await resolveProjectCutStyle('p1');
    expect(r).toMatchObject({ styleName: 'relaxed', source: 'project', overrides: [] });
  });

  it('live settings from the caller win over project.json', async () => {
    env.project = project({ cutStyle: { base: 'relaxed' } });
    const r = await resolveProjectCutStyle('p1', { settings: { cutStyle: { base: 'natural' } } });
    expect(r).toMatchObject({ styleName: 'natural', source: 'project' });
  });

  it('an explicit call style wins and needs no project', async () => {
    env.project = null;
    const r = await resolveProjectCutStyle('p1', { callStyle: 'relaxed' });
    expect(r).toMatchObject({ styleName: 'relaxed', source: 'call', displayName: 'relaxed · requested' });
  });

  it('an unreadable project resolves to the default instead of failing', async () => {
    env.project = null;
    expect(await resolveProjectCutStyle('p1')).toMatchObject({ styleName: 'tight', source: 'default' });
  });
});
