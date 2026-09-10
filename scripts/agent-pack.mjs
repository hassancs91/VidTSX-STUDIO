// Build, check and sign a `.vidtsxagent` package (agents plan §1.6).
//
//   node scripts/agent-pack.mjs <folder> --check
//   node scripts/agent-pack.mjs <folder> --hash      (rewrite files[] in agent.json)
//   node scripts/agent-pack.mjs <folder> --out dist/vidtsx.motion-post.vidtsxagent [--key <path>]
//   node scripts/agent-pack.mjs --genkey [--key-id vidtsx-1]
//
// The author's checker IS the install validator: `parseAgentManifest` and
// `signAgentManifest` are bundled straight out of `src/` with esbuild, so a
// package that passes `--check` passes the app's rules by construction, and the
// signer can never drift from the verifier on what "canonical JSON" means.
//
// The signing PRIVATE key never lives in the repo: `--key <path>`, else the
// path in `VIDTSX_AGENT_SIGNING_KEY`. Without either, the package is written
// unsigned, which installs with the "Unverified" tag.

import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_NAME = 'agent.json';
/** Written by the store after signing, or by this script — never packed as input. */
const SIDE_FILES = new Set(['signature.json', 'licensee.json']);

// ─── argv ───────────────────────────────────────────────────────────────────

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

// ─── the app's own rules, bundled out of src/ ───────────────────────────────

/** Bundle the pure validator + signer into a temp ESM file and import it. */
async function loadAppRules() {
  const esbuild = await import('esbuild');
  const outfile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), 'agent-pack-')),
    'rules.mjs',
  );
  await esbuild.build({
    stdin: {
      contents: [
        "export { parseAgentManifest, AgentManifestError, AGENT_LIMITS } from './src/shared/agents/manifest';",
        "export { AGENT_TOOL_IDS } from './src/shared/agents/tool-ids';",
        "export { ARTIFACT_KINDS, INTERACTION_KINDS } from './src/shared/types/agents';",
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

// ─── the folder → files[] ───────────────────────────────────────────────────

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

/** The manifest as it will ship: the author's `agent.json` plus a fresh
 *  `files[]` built from what is actually in the folder. */
async function buildManifest(folder) {
  let authored;
  try {
    authored = JSON.parse(await fs.readFile(path.join(folder, MANIFEST_NAME), 'utf-8'));
  } catch (err) {
    fail(`Could not read ${path.join(folder, MANIFEST_NAME)}: ${err.message}`);
  }
  const files = [];
  // Sorted so the manifest — and therefore the signature — is reproducible.
  for (const rel of (await walk(folder)).sort()) {
    const abs = path.join(folder, rel);
    files.push({ path: rel, size: (await fs.stat(abs)).size, sha256: await hashFile(abs) });
  }
  return { ...authored, files };
}

function reportProblems(err, rules) {
  if (err instanceof rules.AgentManifestError) {
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

// ─── signing ────────────────────────────────────────────────────────────────

async function readSigningKey(flags) {
  const keyPath = typeof flags.key === 'string' ? flags.key : process.env.VIDTSX_AGENT_SIGNING_KEY;
  if (!keyPath) return null;
  try {
    return { pem: await fs.readFile(keyPath, 'utf-8'), keyId: flags['key-id'] ?? 'vidtsx-1' };
  } catch (err) {
    fail(`Could not read the signing key at ${keyPath}: ${err.message}`);
  }
}

function generateKey(flags) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = typeof flags['key-id'] === 'string' ? flags['key-id'] : 'vidtsx-1';
  console.log('\nPRIVATE KEY — save this OUTSIDE the repo and point');
  console.log('VIDTSX_AGENT_SIGNING_KEY at the file. It is never committed.\n');
  console.log(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
  console.log('Add this entry to src/shared/agents/publishers.ts:\n');
  console.log('  {');
  console.log(`    keyId: '${keyId}',`);
  console.log("    name: 'VidTSX',");
  console.log(`    publicKey: '${publicKey.export({ format: 'der', type: 'spki' }).toString('base64')}',`);
  console.log('  },\n');
}

// ─── zipping ────────────────────────────────────────────────────────────────

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
  if (signature) {
    archive.append(JSON.stringify(signature, null, 2), { name: 'signature.json' });
  }
  for (const file of manifest.files) {
    archive.file(path.join(folder, file.path), { name: file.path });
  }
  await archive.finalize();
  await closed;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.genkey) {
    generateKey(args.flags);
    return;
  }

  const folder = args.positional[0];
  if (!folder) {
    fail('Usage: node scripts/agent-pack.mjs <folder> [--check | --out <file>] [--key <path>]');
  }

  const rules = await loadAppRules();
  const manifest = await buildManifest(path.resolve(folder));
  try {
    rules.parseAgentManifest(manifest, {
      appVersion: await appVersion(),
      toolIds: rules.AGENT_TOOL_IDS,
      artifactKinds: rules.ARTIFACT_KINDS,
      interactionKinds: rules.INTERACTION_KINDS,
    });
  } catch (err) {
    reportProblems(err, rules);
  }

  const totalBytes = manifest.files.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\n✓ ${manifest.id} ${manifest.version} — ${manifest.files.length} files, ${totalBytes} bytes`,
  );

  if (args.flags.check) {
    console.log('  (--check: nothing written)\n');
    return;
  }

  // A built-in ships as a folder, not a package, so its manifest's `files[]`
  // is maintained by hand — this is the hand. The authored keys stay in their
  // order; only `files[]` is replaced.
  if (args.flags.hash) {
    const manifestPath = path.join(path.resolve(folder), MANIFEST_NAME);
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    console.log(`  (--hash: files[] rewritten in ${manifestPath})\n`);
    return;
  }

  const out =
    typeof args.flags.out === 'string'
      ? args.flags.out
      : `${manifest.id.replace('/', '.')}${'.vidtsxagent'}`;

  const key = await readSigningKey(args.flags);
  const signature = key ? rules.signAgentManifest(manifest, key.pem, key.keyId) : null;
  await writePackage(path.resolve(folder), manifest, signature, out);
  console.log(`  ${signature ? `signed as ${key.keyId}` : 'UNSIGNED'} → ${out}\n`);
}

main().catch((err) => fail(err?.stack ?? String(err)));
