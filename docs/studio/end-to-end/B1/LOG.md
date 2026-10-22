# B1 — log (append-only, one dated line per agent)

- 2026-10-22 10:55 · orchestrator · HANDOFF.md created, status NEW; M2 setup folded in as step 1; 8 kHz vs 16 kHz ZCR trap noted.
- 2026-10-22 11:25 · agent 1 · step A done (`2dc5add`): `zcr` per bucket in the waveform job (v3, mono 16 kHz for the whole job; v1/v2 caches regenerate), `RmsEnvelope` → `rms-envelope.ts` with overlap-weighted windows + a 50 ms-window floor, `zcr` / `snapHead` / fricative `snapTail`, the `minSkip` merge, the four optional knobs; 29 new unit tests. Gates: full vitest 439 files / 3699 tests green, check:types 26/10 ok. Next: M2 setup.
