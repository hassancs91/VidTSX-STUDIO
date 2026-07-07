---
name: example-skill
description: Template showing the skill file format. The leading underscore in the filename tells the loader to skip this file, so it never accidentally gets composed into a real prompt.
when_to_use: Never — this is documentation. Copy it to a new file (without the underscore) to author a real skill.
---

# Example skill

This is the body of the skill. Everything below the closing `---` is plain markdown
and gets concatenated verbatim into the system prompt when this skill is composed
into an LLM call.

## How the body is rendered

The composer prepends `## Skill: {name}` and emits this markdown as-is. Use any
markdown you'd put in a Claude Code skill: headings, bullet lists, fenced code
blocks, tables.

## Tips for writing good skills

- Be imperative. Say "Always pass `compositionConfig`" not "you might want to pass
  `compositionConfig`".
- Mention the exact file paths or function names the LLM should look at.
- Include one concrete example. The LLM will pattern-match off it.
- Keep it under ~200 lines. If it's longer, split into two skills.
