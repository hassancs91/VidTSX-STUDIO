// Reading the skills an agent package ships (`skills/<id>/SKILL.md`, plan §1.1).
//
// Same format as `resources/skills`, parsed with the same parser
// (`shared/skills/parse-skill`). Resources beside a SKILL.md are NOT read here:
// they are for tools to open on demand, so a package with a large reference
// folder does not silently become a large system prompt.

import fs from 'fs/promises';
import path from 'path';
import { parseSkillFrontmatter } from '../../../shared/skills/parse-skill';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentSkills');

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  body: string;
}

/** Skills in id order, so the composed prompt is stable across runs. */
export async function loadAgentSkills(agentDir: string): Promise<AgentSkill[]> {
  const skillsDir = path.join(agentDir, 'skills');
  let entries: string[];
  try {
    entries = (await fs.readdir(skillsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    return []; // No skills folder is normal.
  }

  const skills: AgentSkill[] = [];
  for (const id of entries) {
    let raw: string;
    try {
      raw = await fs.readFile(path.join(skillsDir, id, 'SKILL.md'), 'utf-8');
    } catch {
      log.warn('Agent skill folder has no SKILL.md — skipped', { id });
      continue;
    }
    const { meta, body } = parseSkillFrontmatter(raw);
    if (!meta.name || !meta.description) {
      log.warn('Agent skill missing name/description frontmatter — skipped', { id });
      continue;
    }
    skills.push({ id, name: meta.name, description: meta.description, body });
  }
  return skills;
}
