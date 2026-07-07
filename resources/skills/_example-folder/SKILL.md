---
name: Example Folder Skill
description: Template showing the folder-format skill convention. The leading underscore in the folder name tells the loader to skip this skill, so it never gets composed into a real prompt. Copy this folder (without the underscore) to author a real folder-format skill.
when_to_use: Never — this is documentation. Copy it to a new folder name to create a real skill.
---

# Example folder skill

This is the entry point for a folder-format skill. The same SKILL.md frontmatter
rules apply (`name` and `description` required, `when_to_use` optional).

## When to use the folder format

Pick the folder format over a flat `.md` file when your skill needs:

- Companion **reference docs** (vocabulary lists, JSON schemas, examples).
- **Templates** the skill instructs the model to follow.
- **Scripts** that a feature might run when this skill is active.
- **Images / SVGs** the skill describes.

If you have only prose with no companion files, a flat `<skill-id>.md` file at
the top of `resources/skills/` is simpler and works identically for the prompt
composition.

## Layout

```
resources/skills/
  my-skill/
    SKILL.md           ← required, this file
    reference.md       ← optional resource
    examples/
      example-1.json   ← nested resources are walked recursively
      example-2.json
    scripts/
      helper.ts
```

## Accessing resources from feature code

The registry exposes the folder path on the manifest:

```ts
const skill = await loadSkill('my-skill');
// skill.resourcesDir → absolute path to the folder
// skill.resources    → ['reference.md', 'examples/example-1.json', ...]

const refContent = await readSkillResource('my-skill', 'reference.md');
```

`readSkillResource` blocks path traversal (`..`) and only reads files under the
skill's own folder.

## Bundling

Everything in `resources/skills/` ships with packaged builds via electron-builder
`extraResources` (filter `**/*`, dotfiles excluded). No extra step required —
just drop your folder in.
