// W7: the tsx-composer's `tsx-craft` skill is GENERATED from the 2D generate
// prompt's craft rules. These tests are the drift guard — when either side
// moves, `node scripts/gen-tsx-craft-skill.mjs` brings the file back in step.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSkillFrontmatter } from '../../skills/parse-skill';
import { buildGenerate2dPrompt } from './generate-2d-prompt';
import { TSX_CRAFT_RULES } from './tsx-craft';
import { renderTsxCraftSkill } from './tsx-craft-skill';

const SKILL_FILE = path.resolve(
  __dirname,
  '../../../../resources/agents/vidtsx/tsx-composer/skills/tsx-craft/SKILL.md',
);

describe('tsx-craft skill (W7)', () => {
  it('the SKILL.md on disk is exactly the rendered skill', () => {
    const onDisk = fs.readFileSync(SKILL_FILE, 'utf-8').replace(/\r\n/g, '\n');
    expect(onDisk).toBe(renderTsxCraftSkill());
  });

  it('the 2D generate prompt carries the same rules verbatim', () => {
    expect(buildGenerate2dPrompt()).toContain(TSX_CRAFT_RULES);
    expect(buildGenerate2dPrompt({ fps: 30, videoWidth: 1080, videoHeight: 1920 })).toContain(
      TSX_CRAFT_RULES,
    );
  });

  it('parses as a skill with the required frontmatter', () => {
    const { meta, body } = parseSkillFrontmatter(renderTsxCraftSkill());
    expect(meta.name).toBe('TSX craft');
    expect(meta.description).toBeTruthy();
    expect(body).toContain('## Style presets');
    expect(body).toContain('## Layout');
    expect(body).toContain('## Typography');
  });

  it('holds the three craft sections and nothing mechanical', () => {
    expect(TSX_CRAFT_RULES.startsWith('## Style presets')).toBe(true);
    expect(TSX_CRAFT_RULES).not.toContain('${');
    expect(TSX_CRAFT_RULES).not.toContain('compositionConfig');
    expect(TSX_CRAFT_RULES).not.toContain('import ');
  });
});
