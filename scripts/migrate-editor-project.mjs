// Migrate a claude-youtube-editor project into a VidTSX Studio project.
//
//   node scripts/migrate-editor-project.mjs --ref=<editor repo> --video=video-2
//
// The reference repo is where Studio's model came from, so the two agree on
// the important thing — a master lane with TSX shots laid over it. What they
// do NOT agree on is the shot FILE contract: reference shots import a shared
// kit, brand tokens, fonts, lucide-react and local helpers, while Studio
// requires one self-contained file importing react + remotion + @vidtsx/kit
// only. That gap is closed here mechanically (esbuild bundle), never by an LLM
// rewrite — the point is to run Hasan's real code, not a paraphrase of it.
//
// Three normalisations are needed on top of the bundle, and each is a place
// where Studio's LINT is stricter than Studio's own RUNTIME:
//   remotion/no-react  @remotion/google-fonts wants one boolean constant from
//                      it; the module server serves this subpath happily.
//   react/jsx-runtime  lucide-react ships pre-compiled against the automatic
//                      runtime; likewise served, likewise rejected by the lint.
//   export shape       esbuild emits `export { X as default }`; the gate greps
//                      for a literal `export default` / `export const
//                      compositionConfig =`.
// All three are cosmetic — the module's actual exports are unchanged — so the
// gate is satisfied rather than weakened. See docs/studio/CAPABILITY_GAPS.md.
//
// What does NOT migrate is recorded, not silently dropped: reference `split`
// and `insert` shots have no Studio equivalent (crop and time-insertion), so
// they are skipped and reported. That report is the point of the exercise as
// much as the project is.

import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const FFPROBE = path.join(
  REPO,
  'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe',
);

// Studio's shot gate allows no subpaths at all; these must inline instead.
const NO_REACT = new RegExp('^remotion/no-react$');
const JSX_RUNTIME = new RegExp('^react/jsx-(dev-)?runtime$');
const TRAILING_EXPORT = new RegExp('export\\s*\\{([^}]*)\\}\\s*;?\\s*$');
const AS_DEFAULT = new RegExp('\\bas default$');
const AS_DEFAULT_SUFFIX = new RegExp('\\s+as default$');

/** jsx()/jsxs() over React.createElement — createElement reads `children` out
 *  of the props object when no extra args are passed, so this is exact. */
const JSX_SHIM = [
  "import React from 'react';",
  'export const Fragment = React.Fragment;',
  'export const jsx = (type, props, key) =>',
  '  React.createElement(type, key === undefined ? props : { ...props, key });',
  'export const jsxs = jsx;',
  'export const jsxDEV = jsx;',
].join('\n');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    ref: 'C:/Users/Malak/Documents/GitHub/claude-youtube-editor',
    video: 'video-2',
    to: null,
    fps: 30,
    width: 1920,
    height: 1080,
    dryRun: false,
  };
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'ref') out.ref = v;
    else if (k === 'video') out.video = v;
    else if (k === 'to') out.to = v;
    else if (k === 'fps') out.fps = Number(v);
    else if (k === 'width') out.width = Number(v);
    else if (k === 'height') out.height = Number(v);
    else if (k === 'dry-run') out.dryRun = true;
    else throw new Error(`Unknown flag: --${k}`);
  }
  out.to ??= out.video;
  return out;
}

function studioProjectsRoot() {
  return process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
}

// ---------------------------------------------------------------------------
// shot bundling
// ---------------------------------------------------------------------------

function makeInlinePlugin(refRemotion) {
  return {
    name: 'inline-subpaths',
    setup(b) {
      b.onResolve({ filter: NO_REACT }, () => ({
        path: path.join(refRemotion, 'node_modules/remotion/dist/esm/no-react.mjs'),
        external: false,
      }));
      b.onResolve({ filter: JSX_RUNTIME }, () => ({ path: 'jsx-shim', namespace: 'shim' }));
      b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: JSX_SHIM, loader: 'js' }));
    },
  };
}

/** esbuild's `export { A, B as default }` → the literal forms the gate greps
 *  for. Presentation only: the module's exports are unchanged. */
function normaliseExports(code) {
  let hoisted = false;
  let out = code.replace(TRAILING_EXPORT, (_m, inner) => {
    const parts = inner.split(',').map((x) => x.trim()).filter(Boolean);
    const def = parts.find((x) => AS_DEFAULT.test(x));
    const name = def ? def.replace(AS_DEFAULT_SUFFIX, '') : null;
    const rest = parts.filter((x) => x !== def && x !== 'compositionConfig');
    hoisted = parts.includes('compositionConfig');
    const named = rest.length ? `export { ${rest.join(', ')} };\n` : '';
    return named + (name ? `export default ${name};\n` : '');
  });
  if (hoisted) {
    out = out.replace(
      new RegExp('^var compositionConfig = ', 'm'),
      'export const compositionConfig = ',
    );
  }
  return out;
}

/**
 * Point the reference kit's `lib()` helper at an absolute media path.
 *
 * The reference repo resolves `lib(name)` against its Remotion publicDir
 * (`<ref>/media`). Studio has no publicDir: its virtual `staticFile` rewrites
 * ANY path to `<moduleServer>/asset?path=…`, which resolves absolute paths and
 * nothing else. Because the bundle keeps `lib` as a single definition, one
 * rewrite fixes every call site including the template-literal ones.
 *
 * KNOWN LIMIT — this is preview-only. Export bundles against the REAL remotion,
 * whose `staticFile` prepends `public/`, so an absolute path breaks there. That
 * asymmetry is exactly what Studio's "never hardcode a path, use the `assets`
 * prop" rule exists to prevent, and closing it properly means registering the
 * media as project assets + `shot.assetRefs`. Recorded as a capability gap
 * rather than papered over: see docs/studio/CAPABILITY_GAPS.md.
 */
const LIB_DEF = 'var lib = (name) => staticFile(`${name}`);';
function rewriteLibRoot(code, mediaRoot) {
  if (!code.includes(LIB_DEF)) return { code, rewritten: false };
  return {
    code: code.replace(LIB_DEF, `var lib = (name) => staticFile(\`${mediaRoot}/\${name}\`);`),
    rewritten: true,
  };
}

async function bundleShot(refRemotion, shotsDir, fileName) {
  const r = await esbuild.build({
    entryPoints: [path.join(shotsDir, fileName)],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    external: ['react', 'remotion'],
    absWorkingDir: refRemotion,
    write: false,
    logLevel: 'silent',
    legalComments: 'none',
    plugins: [makeInlinePlugin(refRemotion)],
  });
  return normaliseExports(r.outputFiles[0].text);
}

/** `export const compositionConfig = {...}` read out of the bundled source. */
function readCompositionConfig(code, fps) {
  const m = /export const compositionConfig = (\{[^}]*\})/.exec(code);
  if (!m) return null;
  let parsed;
  try {
    parsed = Function(`"use strict";return (${m[1]})`)();
  } catch {
    return null;
  }
  const f = typeof parsed.fps === 'number' ? parsed.fps : fps;
  const frames =
    typeof parsed.durationInFrames === 'number'
      ? parsed.durationInFrames
      : Math.round((parsed.durationInSeconds ?? 10) * f);
  return {
    durationInFrames: frames,
    fps: f,
    width: typeof parsed.width === 'number' ? parsed.width : 1920,
    height: typeof parsed.height === 'number' ? parsed.height : 1080,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

function ffprobe(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
      '-show_entries', 'format=duration',
      '-of', 'json',
      file,
    ]);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', () => {
      try {
        const j = JSON.parse(out);
        const s = j.streams?.[0] ?? {};
        const [n, d] = String(s.r_frame_rate ?? '0/1').split('/').map(Number);
        resolve({
          duration: Number(j.format?.duration ?? 0),
          width: s.width,
          height: s.height,
          fps: d ? Math.round((n / d) * 100) / 100 : undefined,
          codec: s.codec_name,
          hasAudio: true,
        });
      } catch (err) {
        reject(new Error(`ffprobe failed on ${file}: ${err.message}`));
      }
    });
  });
}

const uid = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const refRemotion = path.join(args.ref, 'remotion');
  const shotsDir = path.join(refRemotion, 'src/shots', args.video);
  const timelinePath = path.join(args.ref, 'videos', args.video, 'work/timeline.json');

  if (!fsSync.existsSync(timelinePath)) throw new Error(`No timeline.json at ${timelinePath}`);
  if (!fsSync.existsSync(shotsDir)) throw new Error(`No shots dir at ${shotsDir}`);

  const timeline = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
  const masterPath = path.resolve(args.ref, timeline.master);
  if (!fsSync.existsSync(masterPath)) throw new Error(`Master not found: ${masterPath}`);

  console.log(`\nVidTSX Studio — reference project migration`);
  console.log(`  from    : ${args.video}  (${timeline.shots.length} shots)`);
  console.log(`  master  : ${path.basename(masterPath)}`);

  const probe = await ffprobe(masterPath);
  console.log(
    `            ${probe.width}x${probe.height} @ ${probe.fps} ${probe.codec}, ${probe.duration.toFixed(1)}s`,
  );
  console.log(`  target  : ${args.width}x${args.height} @ ${args.fps} — matches the shots' own config\n`);

  // --- sort shots into what maps and what does not --------------------------
  const SUPPORTED = new Set(['cutaway', 'overlay']);
  const migrating = timeline.shots.filter((s) => SUPPORTED.has(s.type));
  const skipped = timeline.shots.filter((s) => !SUPPORTED.has(s.type));

  const shots = [];
  const clips = [];
  const failures = [];
  const mediaBacked = [];

  for (const s of migrating) {
    const file = `${s.id}.tsx`;
    if (!fsSync.existsSync(path.join(shotsDir, file))) {
      failures.push({ id: s.id, why: 'source .tsx not found' });
      continue;
    }
    let code;
    try {
      code = await bundleShot(refRemotion, shotsDir, file);
    } catch (err) {
      failures.push({ id: s.id, why: `bundle failed: ${String(err.message).split('\n')[0]}` });
      continue;
    }
    const libFix = rewriteLibRoot(code, path.join(args.ref, 'media').replace(/\\/g, '/'));
    code = libFix.code;
    if (libFix.rewritten) mediaBacked.push(s.id);
    const config = readCompositionConfig(code, args.fps);
    if (!config) {
      failures.push({ id: s.id, why: 'compositionConfig unreadable after bundling' });
      continue;
    }

    const shotId = kebab(s.id);
    shots.push({
      id: shotId,
      name: s.id,
      kind: s.type === 'overlay' ? 'overlay' : 'cutaway',
      createdAt: new Date().toISOString(),
      activeVersion: 1,
      status: 'ready',
      config,
      prompt: s.note ?? undefined,
      origin: { by: 'user' },
      __code: code,
    });

    clips.push({
      id: uid('clip'),
      kind: 'tsx',
      timelineStart: s.master_in_s,
      duration: Math.round((s.master_out_s - s.master_in_s) * 1000) / 1000,
      sourceIn: 0,
      tsx: { shotId, mode: s.type === 'overlay' ? 'overlay' : 'cutaway' },
      origin: { by: 'user' },
      label: s.id,
    });
  }

  // --- project document -----------------------------------------------------
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();
  const project = {
    schemaVersion: 1,
    id: args.to,
    name: `${args.video} (migrated)`,
    createdAt: now,
    updatedAt: now,
    settings: { width: args.width, height: args.height, fps: args.fps, agent: {} },
    assets: [
      {
        id: assetId,
        kind: 'video',
        path: masterPath.replace(/\//g, path.sep),
        probe,
        description: `${args.video} master cut (from claude-youtube-editor)`,
      },
    ],
    timeline: {
      tracks: [
        // UI order is top lane first: shots ride above the master lane, which
        // is exactly "cover, not displace" — a cutaway hides the picture while
        // the master's audio keeps playing underneath.
        { id: 'shots', kind: 'overlay', name: 'TSX shots', clips },
        {
          id: 'v1',
          kind: 'video',
          name: 'Master',
          clips: [
            {
              id: uid('clip'),
              kind: 'video',
              assetId,
              timelineStart: 0,
              duration: Math.round(probe.duration * 1000) / 1000,
              sourceIn: 0,
              origin: { by: 'user' },
            },
          ],
        },
        { id: 'a1', kind: 'audio', name: 'Audio', clips: [] },
      ],
    },
    proposals: [],
    shots: shots.map(({ __code, ...rest }) => rest),
  };

  // --- report ---------------------------------------------------------------
  console.log(`  migrated : ${shots.length}/${timeline.shots.length} shots`);
  const covered = clips.reduce((a, c) => a + c.duration, 0);
  console.log(
    `             ${covered.toFixed(1)}s of TSX over a ${probe.duration.toFixed(1)}s master ` +
    `(${Math.round((covered / probe.duration) * 100)}%)`,
  );
  if (skipped.length > 0) {
    console.log(`\n  SKIPPED — no Studio equivalent (docs/studio/CAPABILITY_GAPS.md):`);
    for (const s of skipped) {
      const why =
        s.type === 'split'
          ? 'needs crop: master scaled+cropped into a box behind a transparent shot'
          : s.type === 'insert'
            ? 'needs time-insertion: freezes the master clock and lengthens the timeline'
            : 'unknown shot type';
      console.log(`    ${s.type.padEnd(7)} ${s.id.padEnd(16)} ${why}`);
    }
  }
  if (mediaBacked.length > 0) {
    console.log(`\n  PREVIEW-ONLY — ${mediaBacked.length} shots load media through lib(), whose paths`);
    console.log('             were rewritten absolute. Studio previews them; export cannot');
    console.log('             resolve them (see rewriteLibRoot above):');
    console.log('             ' + mediaBacked.join(', '));
  }
  if (failures.length > 0) {
    console.log(`\n  FAILED to migrate:`);
    for (const f of failures) console.log(`    ${f.id.padEnd(18)} ${f.why}`);
  }

  if (args.dryRun) {
    console.log('\n  --dry-run: nothing written\n');
    return;
  }

  // --- write ----------------------------------------------------------------
  const dir = path.join(studioProjectsRoot(), 'projects', args.to);
  await fs.mkdir(path.join(dir, 'shots'), { recursive: true });
  await fs.mkdir(path.join(dir, 'cache'), { recursive: true });
  await fs.mkdir(path.join(dir, 'renders'), { recursive: true });

  for (const s of shots) {
    const sd = path.join(dir, 'shots', s.id);
    await fs.mkdir(sd, { recursive: true });
    await fs.writeFile(path.join(sd, 'v1.tsx'), s.__code);
  }
  await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2));

  console.log(`\n  written  : ${dir}`);
  console.log(`  open Studio and pick "${project.name}" — the proxy builds on first open.\n`);
}

main().catch((err) => {
  console.error(`\n[migrate] ${err.message}\n`);
  process.exit(1);
});
