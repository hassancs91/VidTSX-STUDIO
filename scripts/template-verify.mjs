// Verify built-in templates through the app's REAL render path, headless, and
// make their gallery thumbnails (docs/templates-batch-2.md §5 T1).
//
//   node scripts/template-verify.mjs --id vidtsx/github-stars [--format all|portrait] [--no-presets]
//   node scripts/template-verify.mjs --all
//   node scripts/template-verify.mjs --id vidtsx/github-stars --thumb --frame 270 [--backdrop soft]
//
// For each template, format by format: scan → stage (the working copy) → the
// app's generateWrapper (font proxy on) → @remotion/bundler → a server with the
// app's `/asset` route and font proxy → getCompositions → renderStill, once with
// the manifest defaults and once per preset. It fails when the bundle reports a
// canvas other than the format's, or when an image a value names is never
// fetched, or comes back other than 200 — so a preset naming a missing file
// fails here, not in front of a user. Every still lands in
// `.vidtsx-temp/template-verify/out/` so the looks can be LOOKED at.
//
// `--thumb` renders one frame of the 16:9 format with the defaults at 640×360,
// JPEG q86, straight to `<template>/thumb.jpg`. `--backdrop` paints one of the
// overlay stand-ins (shared/templates/backdrops.ts) under the component; an
// overlay template gets `soft` unless told otherwise.
//
// No Electron, no contact with a running dev app: `electron` is a stub whose
// userData is `.vidtsx-temp/template-verify/userData`, and webpack caching is
// off. Webfonts go through the app's font proxy, which fetches Google Fonts on
// a cold cache — a connected machine is assumed.

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const HERE = path.join(REPO_ROOT, 'scripts', 'template-verify');
const TEMP = path.join(REPO_ROOT, '.vidtsx-temp', 'template-verify');

fs.mkdirSync(TEMP, { recursive: true });
const outfile = path.join(TEMP, 'harness.cjs');

await build({
  entryPoints: [path.join(HERE, 'harness.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
  alias: {
    electron: path.join(HERE, 'electron-stub.cjs'),
    '@shared': path.join(REPO_ROOT, 'src', 'shared'),
  },
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: REPO_ROOT,
  env: { ...process.env, VIDTSX_REPO_ROOT: REPO_ROOT, VIDTSX_VERIFY_TEMP: TEMP },
});
process.exit(result.status ?? 1);
