/**
 * Dev-only Content Safety bypass (CONTENT_SAFETY_DESIGN.md D2d, Rev 4).
 *
 * D2d allows exactly one shape of off-switch: one that is COMPILED OUT of
 * release builds, never flag-gated. `import.meta.env.DEV` is replaced with a
 * literal by Vite at build time, so in a production bundle the expression
 * below folds to `false` and the env read is dropped — no setting, flag, or
 * env var can re-enable it in an installer. `scripts/check-release-bundle.mjs`
 * fails the release build if the variable name ever survives into `out/`.
 *
 * Opt-in is per shell, never committed (PowerShell):
 *   $env:VIDTSX_DEV_DISABLE_CONTENT_SAFETY = '1'; npm run dev
 *
 * What it turns off: Gate A's curated blocklist and every Gate B pixel check
 * (images, reference inputs, video frames, captures). What stays on even
 * then: the sexualized-minor terms (generation-gate.ts) — no test needs them.
 *
 * Keep the expression in this exact form: `import.meta.env?.DEV` or a
 * destructured `env` is NOT statically replaced and would ship the branch.
 */
export function isContentSafetyBypassed(): boolean {
  return import.meta.env.DEV && process.env.VIDTSX_DEV_DISABLE_CONTENT_SAFETY === '1';
}
