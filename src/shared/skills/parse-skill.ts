// SKILL.md frontmatter parsing — moved out of `skills-registry.ts` so agent
// packages can parse the skills they ship without importing a main-process
// service (agents plan §4: "a pure move of a parser, the one shared-code
// touch"). Behaviour is unchanged; `skills-registry.ts` now imports this.
//
// Deliberately not YAML: the frontmatter here is a flat `key: value` list, and
// a real YAML parser would accept documents the rest of the app cannot use.

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedSkillFile {
  /** Frontmatter keys, values unquoted. Empty when there is no frontmatter. */
  meta: Record<string, string>;
  /** Everything after the frontmatter, leading whitespace trimmed. */
  body: string;
}

export function parseSkillFrontmatter(raw: string): ParsedSkillFile {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  }
  return { meta, body: match[2].trimStart() };
}
