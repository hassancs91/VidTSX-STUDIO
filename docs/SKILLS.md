# Skills

A skill is a reusable chunk of LLM instructions, stored either as a single
markdown file with YAML frontmatter, or as a folder containing a `SKILL.md`
plus companion resource files. Skills live in `resources/skills/` and ship
with the app via `electron-builder.yml` `extraResources`. They're loaded on
demand by the main-process registry at
[src/main/services/skills-registry.ts](../src/main/services/skills-registry.ts)
and composed into a system prompt when a feature opts in.

This system is **passive**: nothing reads skills automatically. A feature has to
call `composeSystemPrompt()` explicitly. Adding files to `resources/skills/`
with no caller does nothing.

The folder format follows the same convention as Claude Code / Anthropic Agent
Skills, so a skill copied from the web (with companion scripts, references,
templates) drops in unchanged.

## Two formats

Both formats are scanned on every load and produce identical `SkillManifest`s
apart from `resourcesDir` and `resources` (only set for folder skills). The
prompt composer treats them the same — only the `SKILL.md` body (or top-level
`.md` body) is composed.

### Flat format — single file

For trivial skills with no companion files. Filename minus `.md` is the ID.

```
resources/skills/concise-mode.md
```

### Folder format — Claude convention

Pick this when the skill needs reference docs, templates, scripts, or any
non-prose artifact. Folder name is the ID. The folder MUST contain a top-level
`SKILL.md`; everything else is treated as a resource and is walked recursively.

```
resources/skills/pirate-voice/
  SKILL.md           ← required entry point
  reference.md       ← optional resource (any file type)
  examples/
    sample.json      ← nested resources are walked recursively
  scripts/
    helper.ts
```

Live examples in this repo:

- [resources/skills/concise-mode.md](../resources/skills/concise-mode.md) — flat format.
- [resources/skills/pirate-voice/](../resources/skills/pirate-voice/) — folder format with a `reference.md`.
- [resources/skills/_example-folder/](../resources/skills/_example-folder/) — folder-format template (underscore prefix → loader skips it).
- [resources/skills/_example.md](../resources/skills/_example.md) — flat-format template.

## Frontmatter

Same for both formats. The frontmatter goes at the top of the `.md` (flat) or
the `SKILL.md` (folder).

```markdown
---
name: Pirate Voice
description: Makes the assistant respond entirely in pirate-speak.
when_to_use: Testing the skills pipeline end-to-end.
---

# Pirate Voice

...body...
```

Rules:

- `name` and `description` are **required**. Missing either → loader skips with a warning.
- `when_to_use` is optional. Preserved on `SkillManifest` for future trigger logic; not used by the composer today.
- Files / folders starting with `_` or `.` are ignored. Use `_` to keep templates and disabled skills around without activating them.
- Body is plain markdown. The composer concatenates it verbatim under a `## Skill: {name}` heading.
- If a flat file and a folder share the same ID (e.g., `pirate-voice.md` AND `pirate-voice/SKILL.md`), the folder wins and a warning is logged.

## Adding a skill

1. Drop a `.md` file (flat) OR a folder containing `SKILL.md` (folder format) into `resources/skills/`.
2. In dev: restart `npm run dev`, OR call `clearSkillCache()` from the main process to force a reload.
3. In a packaged build: the file/folder is bundled automatically — `extraResources` ships everything under `resources/skills/` (dotfiles excluded).

## Plugging a skill into a feature

The registry runs in the **main process** because it reads the filesystem
directly. The Claude Agent SDK call at
[src/engine/providers/claude-provider.ts](../src/engine/providers/claude-provider.ts)
also runs in main, so wiring is local — no IPC plumbing required.

### Pattern A — main-process call site

```ts
import { composeSystemPrompt } from '../services/skills-registry';

// before
const systemPrompt = MY_FEATURE_PROMPT;

// after
const systemPrompt = await composeSystemPrompt(
  MY_FEATURE_PROMPT,
  ['render-remotion-composition', 'upload-to-r2'],
);
```

### Pattern B — renderer-driven (already wired for AI Chat)

The `LlmGenerateRequest` IPC type accepts an optional `skillIds: string[]`.
[handleLlmGenerate](../src/main/ipc/llm-handlers.ts) calls
`composeSystemPrompt` automatically when present, so the renderer just passes
the IDs:

```ts
await window.api.llmGenerate({
  prompt,
  systemPrompt,
  skillIds: ['concise-mode'],
  // ...
});
```

The renderer can list available skills via `window.api.skillsList()` (returns
`SkillSummary[]` — no body, no filesystem paths).

The composer joins skills in the order requested. Missing skill IDs are logged
as warnings and silently skipped — a typo never breaks an LLM call.

## Reading resource files (folder format only)

Resources are NOT auto-injected into the system prompt. They're available for
feature code to read explicitly.

```ts
import { readSkillResource } from '../services/skills-registry';

const refContent = await readSkillResource('pirate-voice', 'reference.md');
// → file contents as string, or null if missing / outside the skill folder
```

`readSkillResource` blocks path traversal (`..`) — it only reads files under
the skill's own `resourcesDir`. Returns `null` for missing files instead of
throwing, so a typo doesn't break the caller.

The full resource list is on `SkillManifest.resources`:

```ts
const skill = await loadSkill('pirate-voice');
// skill.resourcesDir → absolute path to resources/skills/pirate-voice/
// skill.resources    → ['reference.md']
```

Use cases for resources:

- Reference data the model should consult when active (e.g., a JSON schema you
  splice into the user prompt at call time).
- Example outputs the model can pattern-match against.
- Scripts a feature runs when this skill is enabled.
- Long-form docs that would bloat `SKILL.md` if inlined.

## When to make something a skill vs. inline prompt

Make it a skill when at least one is true:

- 5+ lines of instructions.
- Reused across 2+ features or 2+ LLM calls.
- Owned by a non-engineer (e.g., a prompt the user iterates on without touching TypeScript).
- Has companion files (reference docs, schemas, templates) → folder format.

Otherwise, keep it inline — a constant in the feature's services folder is
fine. See [src/features/prototyper/services/html-system-prompt.ts](../src/features/prototyper/services/html-system-prompt.ts)
for the inline pattern.

## Public API

From [src/main/services/skills-registry.ts](../src/main/services/skills-registry.ts):

```ts
listSkills(): Promise<SkillManifest[]>
loadSkill(id: string): Promise<SkillManifest | null>
composeSystemPrompt(basePrompt: string, skillIds: string[]): Promise<string>
readSkillResource(id: string, relativePath: string): Promise<string | null>
clearSkillCache(): void
```

The `SkillManifest` type is exported from
[src/shared/types/skills.ts](../src/shared/types/skills.ts).

## IPC surface

Already wired for the renderer:

- `window.api.skillsList(): Promise<SkillsListResponse>` — returns
  `SkillSummary[]` (id, name, description, optional `whenToUse` and `resources`).
- `window.api.llmGenerate({ ..., skillIds })` — pass skill IDs to compose them
  into the system prompt for that single call.

`readSkillResource` is intentionally NOT exposed via IPC — resource access is a
main-process concern (e.g., a service splices the file into a request before
calling the LLM). If a renderer ever needs read access, add a thin
`SKILL_RESOURCE_READ` channel that wraps it.
