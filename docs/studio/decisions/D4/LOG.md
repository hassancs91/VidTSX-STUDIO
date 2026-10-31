# D4 — log (append-only, one dated line per event)

- 2026-10-31 ~09:00 · orchestrator: HANDOFF.md + this LOG drafted while D3 ran (committed in `e8fdfbc`).
- 2026-10-31 09:44 · orchestrator: D3 judged FAIL → part (g) dropped; ruling D-r16 (the request shape) added; D4 builder #1 (part (a)) next.
- 2026-10-31 10:00 · D4 builder #1: part (a) DONE at `c7ad6da` (4 files / 66 tests green after a red run; tsc web 25 / node 10); part (b) started red first — `decision-engine.test.ts` + `presets.test.ts` untracked (red on missing modules only); HANDOFF.
- 2026-10-31 10:16 · D4 builder #2: part (b) DONE at `ed79420` (red 10:10: 5 files fail on missing modules only; green 10:13: 9 files / 115 tests; tsc web 25 / node 10; fixture key scan empty); the two untracked red tests passed unchanged; HANDOFF → part (c) next.
- 2026-10-31 10:34 · D4 builder #3: part (c) sub-checkpoint (c1) at `b7b1648` — main's decision services + the `typesafe` registry entry + `'decision'` capability + wire types (red 10:28: 5 files fail on missing modules / registry asserts only; green 10:30: 5 files / 32 tests; related suites 100 / 101 files — the 1 red is the known E-d2a `builder-libraries` package-resolution suite; tsc web 25 / node 10); HANDOFF → (c2) IPC + preload + key-save hook next.
