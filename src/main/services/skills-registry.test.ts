import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, getAppPath: () => tmpDir, isPackaged: false },
}));

import { clearSkillCache, composeSystemPrompt } from './skills-registry';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-skills-registry-test-'));
  const skillsDir = path.join(tmpDir, 'resources', 'skills');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, 'test-skill.md'),
    '---\nname: Test Skill\ndescription: A fixture skill\n---\nSKILL BODY TEXT',
    'utf-8',
  );
  clearSkillCache();
});

afterAll(async () => {
  clearSkillCache();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('composeSystemPrompt trailing block (agent memory position)', () => {
  it('keeps prior behavior: no skills, no trailing → base prompt unchanged', async () => {
    expect(await composeSystemPrompt('BASE', [])).toBe('BASE');
    expect(await composeSystemPrompt('BASE', ['missing-skill'])).toBe('BASE');
  });

  it('appends the trailing block AFTER the skill sections (cache-cost invariant)', async () => {
    const composed = await composeSystemPrompt('BASE', ['test-skill'], 'MEMORY BLOCK');
    expect(composed).toBe(
      'BASE\n\n---\n\n## Skill: Test Skill\n\nSKILL BODY TEXT\n\nMEMORY BLOCK',
    );
    expect(composed.indexOf('## Skill:')).toBeLessThan(composed.indexOf('MEMORY BLOCK'));
  });

  it('places the middle block (the editing preset) after the skills and before the trailing block', async () => {
    const composed = await composeSystemPrompt('BASE', ['test-skill'], 'MEMORY BLOCK', 'PRESET BLOCK');
    expect(composed).toBe(
      'BASE\n\n---\n\n## Skill: Test Skill\n\nSKILL BODY TEXT\n\nPRESET BLOCK\n\nMEMORY BLOCK',
    );
    expect(await composeSystemPrompt('BASE', [], undefined, 'PRESET BLOCK')).toBe('BASE\n\n---\n\nPRESET BLOCK');
  });

  it('trailing block works with no skills at all', async () => {
    expect(await composeSystemPrompt('BASE', [], 'MEMORY BLOCK')).toBe(
      'BASE\n\n---\n\nMEMORY BLOCK',
    );
  });
});
