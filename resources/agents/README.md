# Built-in agents

One folder per agent, `<namespace>/<name>/`, holding the same tree a
`.vidtsxagent` package carries — `agent.json`, `AGENT.md`, `skills/`, `assets/`,
`icon.png`. They ship in the installer through `extraResources`
(`resources/agents → agents`) and are read-only at runtime.

The store reads this root and `<userData>/agents/` together and the **highest
version wins**; an equal version prefers the built-in. So a user can install a
newer copy of a built-in id from a file, and an app update that ships a newer
built-in takes over again by itself (docs/agents-plan.md §1.6).

A built-in needs no signature: it is inside the signed installer already, and it
lists as "Built-in" rather than carrying a trust tag.

Nothing ships here yet — "Motion Post" arrives with Stage 5. To validate a
folder before it lands here:

```
node scripts/agent-pack.mjs resources/agents/<namespace>/<name> --check
```
