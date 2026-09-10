// The `tsx-craft` skill of the built-in `vidtsx/tsx-composer` agent, rendered
// from the SAME craft rules the 2D generate prompt is built from (W7).
//
// Pure: a string in, a string out. `scripts/gen-tsx-craft-skill.mjs` writes
// the result to `resources/agents/vidtsx/tsx-composer/skills/tsx-craft/SKILL.md`
// and `tsx-craft-skill.test.ts` asserts the file on disk equals this render,
// so the prompt and the skill can never say two different things.

import { TSX_CRAFT_RULES } from './tsx-craft';

/** Frontmatter in the `resources/skills` format (docs/SKILLS.md). */
const FRONTMATTER = [
  '---',
  'name: TSX craft',
  'description: The style presets, layout safe zones and type scale the composition tool builds under. Read it before briefing generate_composition or edit_composition — it is the vocabulary the tool understands, so a brief written in these terms comes back the way it was asked for.',
  'when_to_use: Every time you brief or edit a composition.',
  '---',
].join('\n');

const INTRO = [
  '# TSX craft',
  '',
  'The composition tool writes Remotion TSX under the rules below — the SAME',
  'rules, word for word, that its own system prompt carries. You never write',
  'the code; you brief it. Brief in this vocabulary and the tool has nothing',
  'to guess:',
  '',
  '- Name a **style preset** when the user implies one ("neon", "corporate",',
  '  "brutalist"); otherwise say nothing and the tool uses Minimalist. When',
  '  the session has a brand, its palette and fonts are handed to the tool on',
  '  their own — do not restate them, and do not pick a preset that fights',
  '  them.',
  '- Give text sizes inside the **typography** scale, by role (headline,',
  '  subhead, body), not in points you invent.',
  '- Keep every element the user must read inside the **safe zones**; say',
  '  where a thing sits ("upper third", "centred") rather than in pixels.',
  '- Put timing in seconds or frames per beat, and the motion in one sentence',
  '  per beat. Edits are one concrete change each.',
  '',
  'What follows is the tool\'s own text.',
  '',
].join('\n');

/** The whole SKILL.md, exactly as it should read on disk. */
export function renderTsxCraftSkill(): string {
  return `${FRONTMATTER}\n\n${INTRO}\n${TSX_CRAFT_RULES}\n`;
}
