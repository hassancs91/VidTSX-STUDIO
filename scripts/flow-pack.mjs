// Build, check and sign a `.vidtsxflow` package (flows plan §1.7, §0.1
// item 4 — the agents' `agent-pack.mjs` for the flow manifest).
//
//   node scripts/flow-pack.mjs <folder> --check
//   node scripts/flow-pack.mjs <folder> --hash      (rewrite files[] + requires.tools in flow.json)
//   node scripts/flow-pack.mjs <folder> --out dist/vidtsx.thumbnail.vidtsxflow [--key <path>]
//   node scripts/flow-pack.mjs <folder> --sign      (write signature.json beside flow.json — a built-in)
//
// The author's checker IS the install validator: `parseFlowPackageManifest`
// and `signAgentManifest` are bundled straight out of `src/` with esbuild,
// so a package that passes `--check` passes the app's rules by construction,
// and the signer cannot drift from the verifier on what "canonical" means —
// one signing module, two manifest names (decision 10).
//
// The signing PRIVATE key never lives in the repo: `--key <path>`, else the
// path in `VIDTSX_AGENT_SIGNING_KEY` (the same `vidtsx-1` key agents use).
// Without either, the package is written unsigned and installs with the
// "Unsigned" warning. `--genkey` lives in agent-pack.mjs.

import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_NAME = 'flow.json';
const PACKAGE_EXT = '.vidtsxflow';
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'flow-pack-')), 'rules.mjs');
  await esbuild.build({
    stdin: {
      contents: [
        "export { parseFlowPackageManifest, FlowManifestError, graphToolIds } from './src/shared/flows/flow-package';",
        "export { AGENT_TOOL_IDS } from './src/shared/agents/tool-ids';",
        "export { signAgentManifest, canonicalJson } from './src/main/services/agents/agent-signing';",
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

/** The manifest as it will ship: the author's `flow.json` plus a fresh
 *  `files[]` from the folder and `requires.tools` from the graph. */
async function buildManifest(folder, rules) {
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
  const tools = authored.graph?.nodes ? rules.graphToolIds(authored) : [];
  const requires = { tools, capabilities: authored.requires?.capabilities ?? [] };
  return { ...authored, requires, files };
}

function reportProblems(err, rules) {
  if (err instanceof rules.FlowManifestError) {
    console.error('\n✖ This package would be refused at install:\n');
    for (const problem of err.problems) console.error(`   • ${problem}`);
    console.error('');
    process.exit(1);
  }
  throw err;
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
  if (!folder) {
    fail('Usage: node scripts/flow-pack.mjs <folder> [--check | --hash | --sign | --out <file>] [--key <path>]');
  }

  const rules = await loadAppRules();
  const manifest = await buildManifest(path.resolve(folder), rules);
  try {
    rules.parseFlowPackageManifest(manifest, { appVersion: await appVersion(), toolIds: rules.AGENT_TOOL_IDS });
  } catch (err) {
    reportProblems(err, rules);
  }

  const totalBytes = manifest.files.reduce((sum, f) => sum + f.size, 0);
  console.log(`\n✓ ${manifest.id} ${manifest.version} — ${manifest.graph.nodes.length} nodes, ${manifest.files.length} files, ${totalBytes} bytes`);

  if (args.flags.check) {
    console.log('  (--check: nothing written)\n');
    return;
  }

  const manifestPath = path.join(path.resolve(folder), MANIFEST_NAME);
  if (args.flags.hash) {
    // A built-in ships as a folder, not a package, so its `files[]` and
    // `requires.tools` are maintained by hand — this is the hand.
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    console.log(`  (--hash: files[] and requires.tools rewritten in ${manifestPath})\n`);
    return;
  }

  const key = await readSigningKey(args.flags);
  if (args.flags.sign) {
    // Sign the folder in place: signature.json beside flow.json, over the
    // EXACT bytes on disk (re-hash first so the manifest is what --hash wrote).
    if (!key) fail('--sign needs --key <path> or VIDTSX_AGENT_SIGNING_KEY.');
    const onDisk = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    const signature = rules.signAgentManifest(onDisk, key.pem, key.keyId);
    await fs.writeFile(path.join(path.resolve(folder), 'signature.json'), `${JSON.stringify(signature, null, 2)}\n`, 'utf-8');
    console.log(`  signed in place as ${key.keyId} → signature.json\n`);
    return;
  }

  const out = typeof args.flags.out === 'string' ? args.flags.out : `${manifest.id.replace('/', '.')}${PACKAGE_EXT}`;
  const signature = key ? rules.signAgentManifest(manifest, key.pem, key.keyId) : null;
  await writePackage(path.resolve(folder), manifest, signature, out);
  console.log(`  ${signature ? `signed as ${key.keyId}` : 'UNSIGNED'} → ${out}\n`);
}

main().catch((err) => fail(err?.stack ?? String(err)));
