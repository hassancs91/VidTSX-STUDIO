// Build and check a `.vidtsxtemplate` package (docs/templates-plan.md §7 —
// the flows' `flow-pack.mjs` for the template manifest).
//
//   node scripts/template-pack.mjs <folder> --check
//   node scripts/template-pack.mjs <folder> --out dist/acme.countdown.vidtsxtemplate [--key <path>]
//
// <folder> is one template: `template.json`, its entry `.tsx`, the thumbnail and
// `assets/`. Everything in it except dotfiles is packed, so keep it clean.
//
// The author's checker IS the install validator: `parseTemplatePackageManifest`
// and `signAgentManifest` are bundled straight out of `src/` with esbuild, so a
// package that passes `--check` passes the app's manifest rules by construction
// (the app additionally runs the D14 composition gate on the entry at install).
//
// The signing PRIVATE key never lives in the repo: `--key <path>`, else the
// path in `VIDTSX_AGENT_SIGNING_KEY` (the `vidtsx-1` key agents and flows use).
// Without either, the package is written unsigned and installs with a notice.

import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_NAME = 'template.json';
/** Written by the store or by this script — never packed as input. */
const SIDE_FILES = new Set(['signature.json', 'licensee.json']);

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args.positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args.flags[name] = true;
    } else {
      args.flags[name] = next;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Bundle the pure validator + signer into a temp ESM file and import it. */
async function loadAppRules() {
  const esbuild = await import('esbuild');
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'template-pack-')), 'rules.mjs');
  await esbuild.build({
    stdin: {
      contents: [
        "export { parseTemplatePackageManifest } from './src/shared/templates/template-package';",
        "export { TemplateManifestError } from './src/shared/templates/manifest';",
        "export { signAgentManifest } from './src/main/services/agents/agent-signing';",
      ].join('\n'),
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

async function walk(root, prefix = '') {
  const out = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walk(root, rel)));
    } else if (entry.isFile() && rel !== MANIFEST_NAME && !SIDE_FILES.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

async function hashFile(absPath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(absPath)) hash.update(chunk);
  return hash.digest('hex');
}

/** The manifest as it will ship: the author's `template.json` plus a fresh `files[]`. */
async function buildManifest(folder) {
  let authored;
  try {
    authored = JSON.parse(await fs.readFile(path.join(folder, MANIFEST_NAME), 'utf-8'));
  } catch (err) {
    fail(`Could not read ${path.join(folder, MANIFEST_NAME)}: ${err.message}`);
  }
  const files = [];
  for (const rel of (await walk(folder)).sort()) {
    const abs = path.join(folder, rel);
    files.push({ path: rel, size: (await fs.stat(abs)).size, sha256: await hashFile(abs) });
  }
  return { ...authored, files };
}

async function appVersion() {
  const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  return pkg.version;
}

async function readSigningKey(flags) {
  const keyPath = typeof flags.key === 'string' ? flags.key : process.env.VIDTSX_AGENT_SIGNING_KEY;
  if (!keyPath) return null;
  try {
    return { pem: await fs.readFile(keyPath, 'utf-8'), keyId: flags['key-id'] ?? 'vidtsx-1' };
  } catch (err) {
    fail(`Could not read the signing key at ${keyPath}: ${err.message}`);
  }
}

async function writePackage(folder, manifest, signature, outFile) {
  const { default: archiver } = await import('archiver');
  await fs.mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
  const output = createWriteStream(outFile);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const closed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_NAME });
  if (signature) archive.append(JSON.stringify(signature, null, 2), { name: 'signature.json' });
  for (const file of manifest.files) archive.file(path.join(folder, file.path), { name: file.path });
  await archive.finalize();
  await closed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const folder = args.positional[0];
  if (!folder || (!args.flags.check && typeof args.flags.out !== 'string')) {
    fail('Usage: node scripts/template-pack.mjs <folder> (--check | --out <file.vidtsxtemplate>) [--key <path>]');
  }

  const rules = await loadAppRules();
  const manifest = await buildManifest(path.resolve(folder));
  try {
    rules.parseTemplatePackageManifest(manifest, { appVersion: await appVersion() });
  } catch (err) {
    if (err instanceof rules.TemplateManifestError) {
      console.error('\n✖ This package would be refused at install:\n');
      for (const problem of err.problems) console.error(`   • ${problem}`);
      console.error('');
      process.exit(1);
    }
    throw err;
  }

  const totalBytes = manifest.files.reduce((sum, f) => sum + f.size, 0);
  console.log(`\n✓ ${manifest.id} ${manifest.version} — ${manifest.controls?.length ?? 0} controls, ${manifest.files.length} files, ${totalBytes} bytes`);
  if (args.flags.check) {
    console.log('  (--check: nothing written)\n');
    return;
  }

  const key = await readSigningKey(args.flags);
  const signature = key ? (rules.signAgentManifest(manifest, key.pem, key.keyId)) : null;
  await writePackage(path.resolve(folder), manifest, signature, args.flags.out);
  console.log(`  wrote ${args.flags.out} (${signature ? `signed, key ${key.keyId}` : 'unsigned'})\n`);
}

await main();
