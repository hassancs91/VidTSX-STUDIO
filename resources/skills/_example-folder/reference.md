# Example resource file

This is a companion file in a folder-format skill. It does NOT get
auto-injected into the system prompt — only `SKILL.md` is composed.

Resource files are accessible to feature code via:

```ts
import { readSkillResource } from '../services/skills-registry';

const content = await readSkillResource('my-skill', 'reference.md');
```

Use cases for resource files:

- Reference data the model should consult when active (e.g., a JSON schema).
- Example outputs the model can pattern-match against.
- Scripts a feature runs when this skill is enabled.
- Long-form docs that would bloat `SKILL.md` if inlined.
