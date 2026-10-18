import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadAgentSkills } from './agent-skills';

// An agent package's skills (plan §1.1), and T8's `builder: true` (P4 part 3):
// a skill marked for the TSX builder keeps the flag, the rest do not get one.

let dir: string;

async function skill(id: string, frontmatter: string, body: string): Promise<void> {
  await fs.mkdir(path.join(dir, 'skills', id), { recursive: true });
  await fs.writeFile(path.join(dir, 'skills', id, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}\n`, 'utf-8');
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-skills-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('loadAgentSkills', () => {
  it('reads skills in id order and keeps the builder flag only where it is true', async () => {
    await skill('b-house-look', 'name: House look\ndescription: Ink lines.\nbuilder: true', '# House look');
    await skill('a-ideas', 'name: Picture ideas\ndescription: Three metaphors.', '# Ideas');
    await skill('c-not-builder', 'name: Notes\ndescription: Plain.\nbuilder: false', '# Notes');
    const skills = await loadAgentSkills(dir);
    expect(skills).toEqual([
      { id: 'a-ideas', name: 'Picture ideas', description: 'Three metaphors.', body: '# Ideas\n' },
      { id: 'b-house-look', name: 'House look', description: 'Ink lines.', body: '# House look\n', builder: true },
      { id: 'c-not-builder', name: 'Notes', description: 'Plain.', body: '# Notes\n' },
    ]);
  });

  it('a package with no skills folder has none', async () => {
    expect(await loadAgentSkills(dir)).toEqual([]);
  });
});
