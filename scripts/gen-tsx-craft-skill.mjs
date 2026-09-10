// Regenerate the tsx-composer's `tsx-craft` skill from the 2D generate
// prompt's craft rules (V1 completion plan §2.7, W7).
//
//   node scripts/gen-tsx-craft-skill.mjs
//   node scripts/agent-pack.mjs resources/agents/vidtsx/tsx-composer --hash
//
// The skill body is `renderTsxCraftSkill()` out of src/ — bundled with esbuild
// the way agent-pack.mjs bundles the validator — so the file on disk can only
// ever say what the prompt says. `tsx-craft-skill.test.ts` fails when the two
// drift; run the second line afterwards so the manifest's file hashes follow.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SKILL_FILE = path.join(
  REPO_ROOT,
  'resources/agents/vidtsx/tsx-composer/skills/tsx-craft/SKILL.md',
);

async function loadRenderer() {
  const esbuild = await import('esbuild');
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-craft-')), 'skill.mjs');
  await esbuild.build({
    stdin: {
      contents:
        "export { renderTsxCraftSkill } from './src/shared/tsx-engine/prompts/tsx-craft-skill';",
      resolveDir: REPO_ROOT,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

const { renderTsxCraftSkill } = await loadRenderer();
const text = renderTsxCraftSkill();
await fs.mkdir(path.dirname(SKILL_FILE), { recursive: true });
await fs.writeFile(SKILL_FILE, text, 'utf-8');
console.log(`wrote ${path.relative(REPO_ROOT, SKILL_FILE)} (${Buffer.byteLength(text)} bytes)`);
