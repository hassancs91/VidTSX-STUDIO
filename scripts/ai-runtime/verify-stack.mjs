// verify-stack.mjs — prove a built AI-runtime zip installs and runs exactly the way the app will.
//
//   node scripts/ai-runtime/verify-stack.mjs <zip> [--sha256 <hex>] [--dest <dir>] [--keep]
//                                                  [--expect-cuda] [--force-cpu] [--json <out.json>]
//
// 1. sha256 the zip and compare with --sha256 or the <zip>.sha256 sidecar build-stack.ps1 wrote.
// 2. Extract to a fresh temp dir with the SAME call the app uses
//    (createReadStream(zip).pipe(unzipper.Extract({ path })) — src/main/services/download-manager/download-extract.ts).
// 3. Read manifest.json; recount files / bytes / deepest relative path and compare with the manifest.
// 4. Run resources/pipelines/{triposr,rembg}/runner.py --selftest with the extracted python.exe,
//    offline env, no bytecode writes; assert the `ready` line and that ready.torch === manifest.torch.
//    (First launch of freshly-extracted files is slow on purpose — Defender scans ~27k new files;
//    Stage 0 measured ~30 s. That number is recorded, not treated as a failure.)
// 5. Delete the temp dir (unless --keep) and print a JSON summary. Exit 0 = PASS.
//
// This is the Stage 1 test (plan §2 step 7). It needs the repo's node_modules (unzipper) and
// no Python on the build box: the interpreter under test is the one inside the zip.
import { createReadStream, statSync, readdirSync, readFileSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import unzipper from 'unzipper';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const pipelinesDir = path.join(repoRoot, 'resources', 'pipelines');

// ---- args ------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = { keep: false, expectCuda: false, forceCpu: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--sha256': opt.sha256 = argv[++i]; break;
    case '--dest': opt.dest = argv[++i]; break;
    case '--json': opt.json = argv[++i]; break;
    case '--keep': opt.keep = true; break;
    case '--expect-cuda': opt.expectCuda = true; break;
    case '--force-cpu': opt.forceCpu = true; break;
    default:
      if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
      opt.zip = a;
  }
}
if (!opt.zip) {
  console.error('usage: node scripts/ai-runtime/verify-stack.mjs <zip> [--sha256 <hex>] [--dest <dir>] [--keep] [--expect-cuda] [--force-cpu] [--json <out>]');
  process.exit(2);
}
const zipPath = path.resolve(opt.zip);

// ---- helpers ---------------------------------------------------------------------------------
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
  console.error(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  -- ${detail}` : ''}`);
}
function sha256File(p) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(p).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}
function walk(dir, root, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, root, acc); continue; }
    const rel = path.relative(root, p);
    if (rel.toLowerCase() === 'manifest.json') continue; // excluded from the manifest's own numbers
    acc.files += 1;
    acc.bytes += statSync(p).size;
    if (rel.length > acc.maxRel) { acc.maxRel = rel.length; acc.deepest = rel; }
  }
  return acc;
}
function runSelftest(pythonExe, pipeline) {
  const runner = path.join(pipelinesDir, pipeline, 'runner.py');
  const env = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUTF8: '1',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
  };
  // Win32 drops an EMPTY env value, so forcing CPU must be "-1", never "" (Stage 0 gotcha 4).
  if (opt.forceCpu) env.CUDA_VISIBLE_DEVICES = '-1';
  const t0 = performance.now();
  const r = spawnSync(pythonExe, [runner, '--selftest'], { env, encoding: 'utf8', windowsHide: true, timeout: 15 * 60 * 1000 });
  const ms = Math.round(performance.now() - t0);
  const lines = (r.stdout ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  let ready = null;
  let error = null;
  let nonJson = 0;
  for (const l of lines) {
    try {
      const evt = JSON.parse(l);
      if (evt.type === 'ready' && !ready) ready = evt;
      if (evt.type === 'error') error = evt;
    } catch {
      nonJson += 1;
    }
  }
  return {
    pipeline,
    ms,
    status: r.status,
    signal: r.signal,
    spawnError: r.error ? r.error.message : null,
    ready,
    error,
    nonJsonLines: nonJson,
    stderrTail: (r.stderr ?? '').split(/\r?\n/).slice(-8).join('\n'),
  };
}

// ---- 1. hash ---------------------------------------------------------------------------------
const zipBytes = statSync(zipPath).size;
console.error(`zip: ${zipPath} (${zipBytes.toLocaleString()} bytes)`);
let t = performance.now();
const sha = await sha256File(zipPath);
const shaMs = Math.round(performance.now() - t);
let expected = opt.sha256 ?? null;
if (!expected && existsSync(`${zipPath}.sha256`)) expected = readFileSync(`${zipPath}.sha256`, 'utf8').trim().split(/\s+/)[0];
if (expected) check('sha256 matches', sha.toLowerCase() === expected.toLowerCase(), `${sha} (${shaMs} ms)`);
else check('sha256 computed (nothing to compare against)', true, `${sha} (${shaMs} ms)`);

// ---- 2. extract exactly like the app -----------------------------------------------------
const dest = opt.dest ? path.resolve(opt.dest) : mkdtempSync(path.join(os.tmpdir(), 'vidtsx-ai-runtime-'));
console.error(`extracting to ${dest}`);
t = performance.now();
let extractError = null;
try {
  await new Promise((resolve, reject) => {
    createReadStream(zipPath).pipe(unzipper.Extract({ path: dest })).on('close', resolve).on('error', reject);
  });
} catch (err) {
  extractError = err instanceof Error ? err.message : String(err);
}
const extractMs = Math.round(performance.now() - t);
check('extract (unzipper.Extract, same call as download-extract.ts)', !extractError, extractError ?? `${extractMs} ms`);

// ---- 3. manifest vs tree ----------------------------------------------------------------------
let manifest = null;
const manifestPath = path.join(dest, 'manifest.json');
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  check('manifest.json readable', false, String(err));
}
let tree = null;
if (manifest) {
  check('manifest.json readable', true, `${manifest.name} python ${manifest.python} torch ${manifest.torch}`);
  t = performance.now();
  tree = walk(dest, dest, { files: 0, bytes: 0, maxRel: 0, deepest: '' });
  const walkMs = Math.round(performance.now() - t);
  check('file count matches manifest.files', tree.files === manifest.files, `${tree.files} vs ${manifest.files} (${walkMs} ms)`);
  check('bytes match manifest.bytesOnDisk', tree.bytes === manifest.bytesOnDisk, `${tree.bytes} vs ${manifest.bytesOnDisk}`);
  check('deepest path matches manifest.maxRelativePathLength', tree.maxRel === manifest.maxRelativePathLength, `${tree.maxRel} vs ${manifest.maxRelativePathLength}: ${tree.deepest}`);
  const rootBudget = 259 - manifest.maxRelativePathLength - 1;
  check('this temp root fits the path budget', dest.length <= rootBudget, `${dest.length} <= ${rootBudget}`);
}

// ---- 4. selftests -----------------------------------------------------------------------------
const pythonExe = path.join(dest, (manifest && manifest.pythonDir) || 'python', 'python.exe');
const selftests = {};
if (existsSync(pythonExe)) {
  for (const pipeline of ['triposr', 'rembg']) {
    const r = runSelftest(pythonExe, pipeline);
    selftests[pipeline] = r;
    const ok = r.status === 0 && r.ready && !r.error && r.nonJsonLines === 0;
    const detail = ok
      ? `${r.ms} ms  ${JSON.stringify(r.ready)}`
      : `exit ${r.status} ${r.spawnError ?? ''} ${r.error ? JSON.stringify(r.error) : ''} nonJson=${r.nonJsonLines}\n${r.stderrTail}`;
    check(`${pipeline} --selftest emits ready`, ok, detail);
  }
  const tr = selftests.triposr ? selftests.triposr.ready : null;
  if (tr && manifest) {
    check('ready.torch === manifest.torch', tr.torch === manifest.torch, `${tr.torch} vs ${manifest.torch}`);
    if (opt.expectCuda) check('cuda available (--expect-cuda)', tr.cuda === true, `cuda=${tr.cuda} device=${tr.device}`);
    if (opt.forceCpu) check('CUDA_VISIBLE_DEVICES=-1 hides the GPU', tr.cuda === false, `cuda=${tr.cuda}`);
    if (manifest.variant === 'cpu') check('cpu variant reports cuda=false', tr.cuda === false, `cuda=${tr.cuda}`);
  }
  const rb = selftests.rembg ? selftests.rembg.ready : null;
  if (rb) check('rembg ready lists CPUExecutionProvider', Array.isArray(rb.providers) && rb.providers.includes('CPUExecutionProvider'), JSON.stringify(rb.providers));
} else {
  check('python.exe present after extraction', false, pythonExe);
}

// ---- 5. cleanup + summary ---------------------------------------------------------------------
let cleanupError = null;
if (!opt.keep) {
  try {
    rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (err) {
    cleanupError = String(err);
  }
  check('temp dir removed', !cleanupError, cleanupError ?? dest);
} else {
  console.error(`kept ${dest}`);
}

const pass = checks.every((c) => c.ok);
const summary = { pass, zipPath, zipBytes, sha256: sha, shaMs, dest, kept: opt.keep, extractMs, manifest, tree, selftests, checks };
const out = JSON.stringify(summary, null, 2);
if (opt.json) writeFileSync(opt.json, out);
console.log(out);
console.error(pass ? `VERIFY PASS  ${path.basename(zipPath)}` : `VERIFY FAIL  ${path.basename(zipPath)}`);
process.exit(pass ? 0 : 1);
