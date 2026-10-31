// Import the reference editor's `sfx/` + `music/` catalogs into a VidTSX asset library.
//
//   node scripts/import-sfx-library.mjs --library <assets root> --from <editor repo>
//        [--dry-run] [--sfx-catalog <file>] [--music-catalog <file>] [--report <json>]
//
// END_TO_END_PLAN T6 "Importer" / E4: files the 45 + 6 clips of
// `<from>/media/library/{sfx,music}/catalog.json` into `<library>/sfx/` and
// `<library>/music/` (byte-identical copies, never an overwrite) with the catalog's
// fields mapped, and upserts each one through the app's OWN `upsertEntry` (probe,
// content hash, the per-root write chain, `version 1 / rev 2`). The logic lives in
// `src/main/services/library/catalog-import.ts`; this script esbuild-bundles it and
// runs it — the index is never re-implemented here.
//
// E-d8: there is no implicit library — `--library` is required and must be an
// existing folder (the app's own library is `<profile>\assets`; pass it explicitly).
// `--dry-run` prints the plan and writes NOTHING (no folder, no copy, no index).
// The catalogs are only read; `--sfx-catalog` / `--music-catalog` read a COPY of a
// catalog while the clips still resolve against `<from>/media/library/<section>/`.
// Exit 0 = no conflict, no missing source, no catalog problem, no failed clip.
//
// The bundle is written to `<repo>/.vidtsx-temp/import-sfx-library/` (gitignored, inside
// the repo so `@remotion/renderer` resolves through node_modules). `electron` is a stub
// whose `app.getPath('userData')` THROWS (the importer never reads an app profile), and
// the settings store is a stub that throws on any use (never opened).

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC = path.join(REPO, 'src');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'import-sfx-library');
const BUNDLE = path.join(OUT_DIR, 'catalog-import.bundle.cjs');
const ENTRY = path.join(SRC, 'main', 'services', 'library', 'catalog-import.ts');
const SETTINGS_DB = path.join(SRC, 'main', 'services', 'settings-db.ts');
const ALIASES = { '@shared/': 'shared', '@main/': 'main', '@logging/': 'logging', '@audio-engine/': 'audio-engine' };
const SECTIONS = ['sfx', 'music'];
const STUB_NS = 'import-sfx-library-stub';

const USAGE = 'usage: node scripts/import-sfx-library.mjs --library <assets root> --from <editor repo> '
  + '[--dry-run] [--sfx-catalog <file>] [--music-catalog <file>] [--report <json>]';

function fail(msg, code = 2) {
  console.error(`import-sfx-library: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { dryRun: false };
  const takes = { '--library': 'library', '--from': 'from', '--sfx-catalog': 'sfxCatalog',
    '--music-catalog': 'musicCatalog', '--report': 'report' };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    if (flag === '--dry-run') { out.dryRun = true; continue; }
    if (flag === '--help' || flag === '-h') { console.log(USAGE); process.exit(0); }
    const key = takes[flag];
    if (!key) fail(`unknown argument ${argv[i]}\n${USAGE}`);
    const value = inline ?? argv[++i];
    if (!value) fail(`${flag} needs a value\n${USAGE}`);
    out[key] = value;
  }
  return out;
}

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isInside = (child, parent) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

function checkArgs(args) {
  if (!args.library) fail(`--library is required (there is no default library)\n${USAGE}`);
  if (!args.from) fail(`--from is required (the editor repo holding media/library/)\n${USAGE}`);
  args.library = path.resolve(args.library);
  args.from = path.resolve(args.from);
  if (!isDir(args.library)) fail(`--library ${args.library} is not an existing folder — refusing`);
  if (!isDir(args.from)) fail(`--from ${args.from} is not an existing folder — refusing`);
  if (isInside(args.library, args.from)) fail(`--library ${args.library} lies inside --from — the editor repo is never written`);
  if (args.report && isInside(args.report, args.from)) fail('--report lies inside --from — the editor repo is never written');
}

function electronStub() {
  return [
    "const os = require('os'); const path = require('path');",
    "const BASE = path.join(os.tmpdir(), 'vidtsx-import-sfx-library');",
    'const app = {',
    '  isPackaged: false,',
    '  getPath(name) {',
    "    if (name === 'userData') throw new Error('import-sfx-library: no app profile is used — the library is the explicit --library');",
    '    return path.join(BASE, String(name));',
    '  },',
    `  getAppPath: () => ${JSON.stringify(REPO)},`,
    "  getVersion: () => '0.0.0-import-sfx-library',",
    "  getName: () => 'VidTSX Studio (import-sfx-library)',",
    '  on: () => app, once: () => app, whenReady: () => Promise.resolve(),',
    '};',
    'module.exports = { app, ipcMain: { handle() {}, on() {}, removeHandler() {} },',
    '  BrowserWindow: { getAllWindows: () => [] }, safeStorage: { isEncryptionAvailable: () => false } };',
  ].join('\n');
}

/** Every export of the real settings-db, each throwing — the importer never opens a settings store. */
function settingsStub() {
  const names = new Set();
  for (const m of fs.readFileSync(SETTINGS_DB, 'utf-8').matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}() { throw new Error('import-sfx-library: the settings store (${n}) is never opened'); }`).join('\n');
}

const stubPlugin = {
  name: 'import-sfx-library-stubs',
  setup(build) {
    build.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: STUB_NS }));
    build.onResolve({ filter: /settings-db$/ }, async (args) => {
      if (args.namespace === STUB_NS || !args.path.startsWith('.')) return undefined;
      const hit = path.resolve(args.resolveDir, args.path);
      return hit === SETTINGS_DB.replace(/\.ts$/, '') ? { path: 'settings-db', namespace: STUB_NS } : undefined;
    });
    build.onResolve({ filter: /^@(shared|main|logging|audio-engine)\// }, async (args) => {
      const prefix = Object.keys(ALIASES).find((p) => args.path.startsWith(p));
      return build.resolve(`./${args.path.slice(prefix.length)}`, { resolveDir: path.join(SRC, ALIASES[prefix]), kind: args.kind });
    });
    // Every other bare specifier (node built-ins, packages) stays a runtime require.
    build.onResolve({ filter: /^[^./]/ }, (args) => (/^[A-Za-z]:[\\/]/.test(args.path) ? undefined : { path: args.path, external: true }));
    build.onLoad({ filter: /.*/, namespace: STUB_NS }, (args) => (args.path === 'electron'
      ? { contents: electronStub(), loader: 'js', resolveDir: REPO }
      : { contents: settingsStub(), loader: 'js', resolveDir: REPO }));
  },
};

async function loadService() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, platform: 'node', format: 'cjs',
    target: 'node20', logLevel: 'warning', plugins: [stubPlugin],
  });
  return createRequire(BUNDLE)(BUNDLE);
}

const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '-');
const ms = (s) => (typeof s === 'number' ? `${s >= 0 ? '+' : ''}${Math.round(s * 1000)} ms` : '-');

function itemLine(it) {
  const m = it.mapped;
  const a = m.audio ?? {};
  const cols = [
    it.action.padEnd(14), it.relPath.padEnd(32), (it.sha256 ?? '-').slice(0, 12).padEnd(12),
    (a.category ?? '-').padEnd(9), `[${(m.tags ?? []).join(',')}]`,
    `${n1(a.loudnessLufs)} LUFS`, `${n1(a.peakDbfs)} dBFS(${a.peakKind ?? '-'})`,
    `used_in: ${m.usedIn.join(',') || '-'}`, `dropped: ${m.dropped.join(',') || '-'}`,
  ];
  if (it.changed.length > 0) cols.push(`changes: ${it.changed.join(',')}`);
  if (m.notes.length > 0) cols.push(`notes: ${m.notes.join('; ')}`);
  if (it.reason) cols.push(`reason: ${it.reason}`);
  if (it.probeDuration !== undefined) {
    cols.push(`probe ${it.probeDuration.toFixed(3)} s`, `probe-catalog ${ms(it.probeDuration - (m.catalogDurationS ?? NaN))}`);
  }
  if (it.error) cols.push(`ERROR: ${it.error}`);
  return cols.join(' · ');
}

function summarize(items) {
  const by = {};
  for (const it of items) by[it.action] = (by[it.action] ?? 0) + 1;
  return by;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  checkArgs(args);
  const t0 = Date.now();
  const service = await loadService();
  const sources = SECTIONS.map((section) => {
    const clipsDir = path.join(args.from, 'media', 'library', section);
    const override = section === 'sfx' ? args.sfxCatalog : args.musicCatalog;
    return { section, catalogPath: override ? path.resolve(override) : path.join(clipsDir, 'catalog.json'), clipsDir };
  });
  for (const s of sources) console.log(`source ${s.section}: catalog ${s.catalogPath} · clips ${s.clipsDir}`);
  console.log(`library: ${args.library}${args.dryRun ? ' (DRY RUN — nothing is written)' : ''}`);

  const plan = await service.planCatalogImport(args.library, sources);
  const items = args.dryRun ? plan.items : await service.applyCatalogImport(args.library, plan);
  for (const it of items) console.log(itemLine(it));
  for (const p of plan.problems) console.log(`PROBLEM · ${p}`);

  const counts = summarize(items);
  const failed = items.filter((it) => it.ok === false).length;
  const bad = (counts.conflict ?? 0) + (counts['missing-source'] ?? 0) + plan.problems.length + failed;
  const noLicence = items.filter((it) => it.mapped.notes.length > 0).map((it) => it.relPath);
  const deltas = items.filter((it) => it.probeDuration !== undefined && it.mapped.catalogDurationS !== undefined)
    .map((it) => Math.round((it.probeDuration - it.mapped.catalogDurationS) * 1000));
  const summary = {
    dryRun: args.dryRun, items: items.length, counts, problems: plan.problems.length, failed,
    noLicence, probeMinusCatalogMs: deltas.length ? { min: Math.min(...deltas), max: Math.max(...deltas), n: deltas.length } : null,
    seconds: (Date.now() - t0) / 1000, exitCode: bad > 0 ? 1 : 0,
  };
  console.log(`summary: ${JSON.stringify(summary)}`);
  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, JSON.stringify({ at: new Date().toISOString(), library: args.library, from: args.from,
      sources, summary, problems: plan.problems, items }, null, 1));
    console.log(`report: ${path.resolve(args.report)}`);
  }
  process.exitCode = summary.exitCode;
}

main().catch((err) => {
  console.error(`import-sfx-library: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
