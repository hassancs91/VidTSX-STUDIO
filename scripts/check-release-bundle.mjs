// Release-bundle gate for the Content Safety dev bypass
// (docs/CONTENT_SAFETY_DESIGN.md D2d + Rev 4).
//
// D2d: a dev-only bypass "must be compiled out of release builds — not
// flag-gated". The bypass is guarded by the literal `import.meta.env.DEV`,
// which Vite folds to `false` in a production build, so every branch that
// mentions the opt-in variable is dropped. This script proves it on the real
// output: if the variable's name survives anywhere in the shipped JS, someone
// wrote a guard Vite can't fold (`import.meta.env?.DEV`, a destructured env,
// a runtime-only check) and the build fails.
//
// Runs after `electron-vite build` in every release script. Sourcemaps are
// skipped — they carry the original source text, not executable code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN = 'VIDTSX_DEV_DISABLE_CONTENT_SAFETY';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');

function collectJs(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJs(full));
    else if (/\.(js|cjs|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

if (!fs.existsSync(OUT)) {
  console.error(`check-release-bundle: ${OUT} not found — run the build first.`);
  process.exit(1);
}

const files = collectJs(OUT);
const offenders = files.filter((file) => fs.readFileSync(file, 'utf-8').includes(FORBIDDEN));

if (offenders.length > 0) {
  console.error(`check-release-bundle: FAIL — the Content Safety dev bypass leaked into the release bundle (${FORBIDDEN}):`);
  for (const file of offenders) console.error(`  ${path.relative(path.join(OUT, '..'), file)}`);
  console.error('Every use must sit behind a literal `import.meta.env.DEV` guard (see src/content-safety-engine/dev-bypass.ts).');
  process.exit(1);
}

console.log(`check-release-bundle: ok — no dev-bypass code in ${files.length} bundled files.`);
