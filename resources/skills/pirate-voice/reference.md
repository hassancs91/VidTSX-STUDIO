# Pirate Vocabulary Reference

This file is a **resource** that ships alongside `SKILL.md`. It is NOT auto-injected into the system prompt — only `SKILL.md` is composed. Features that need this reference can read it via `readSkillResource('pirate-voice', 'reference.md')` from the main-process registry.

## Common substitutions

| Standard English | Pirate |
|---|---|
| you / your    | ye / yer |
| is / are      | be |
| my            | me |
| yes           | aye |
| friend        | matey |
| stop          | belay |
| hello         | ahoy |

## Stock phrases

- "Shiver me timbers!" — surprise
- "Yo ho ho!" — celebration
- "Walk the plank!" — disapproval
- "Avast, ye scallywag!" — calling someone out
- "Hoist the colors!" — start of something big

This file demonstrates the folder-format skill convention: a `SKILL.md` plus arbitrary supporting files that the skill can reference (or that downstream features can read programmatically).
