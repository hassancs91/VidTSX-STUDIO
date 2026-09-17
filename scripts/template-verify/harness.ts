// scripts/template-verify.mjs's body — see that file for what and why.

import fs from 'fs/promises';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderStill } from '@remotion/renderer';
import { scanTemplates } from '../../src/main/services/templates/template-store';
import { stageTemplate } from '../../src/main/services/templates/template-stage';
import { generateWrapper, cleanupWrapper } from '../../src/main/services/composition-wrapper';
import { materializeAbsoluteStaticFiles } from '../../src/main/services/remotion-static-files';
import { applyPreset, buildInputProps, defaultValues } from '../../src/shared/templates/values';
import { DEFAULT_OVERLAY_BACKDROP, isTemplateBackdrop, type TemplateBackdrop } from '../../src/shared/templates/backdrops';
import type { InstalledTemplate, TemplateFormatOption } from '../../src/shared/types/templates';
import { addBackdropToWrapper } from './backdrop-wrapper';
import { startVerifyServer, type VerifyServer } from './server';

const REPO = process.env.VIDTSX_REPO_ROOT ?? process.cwd();
const TEMP = process.env.VIDTSX_VERIFY_TEMP ?? path.join(REPO, '.vidtsx-temp', 'template-verify');

// ─── args ────────────────────────────────────────────────────────────────────

interface Args {
  ids: string[];
  all: boolean;
  format: string;
  presets: boolean;
  thumb: boolean;
  frame: number | null;
  backdrop: TemplateBackdrop | null;
  scale: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { ids: [], all: false, format: 'all', presets: true, thumb: false, frame: null, backdrop: null, scale: 0.5 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) usage(`${flag} needs a value`);
      return value;
    };
    if (flag === '--id') args.ids.push(next());
    else if (flag === '--all') args.all = true;
    else if (flag === '--format') args.format = next();
    else if (flag === '--no-presets') args.presets = false;
    else if (flag === '--thumb') args.thumb = true;
    else if (flag === '--frame') args.frame = Number(next());
    else if (flag === '--scale') args.scale = Number(next());
    else if (flag === '--backdrop') {
      const value = next();
      if (!isTemplateBackdrop(value)) usage(`unknown backdrop "${value}"`);
      args.backdrop = value;
    } else usage(`unknown argument "${flag}"`);
  }
  if (!args.all && args.ids.length === 0) usage('pass --id <namespace/name> or --all');
  if (args.frame !== null && !Number.isInteger(args.frame)) usage('--frame must be an integer');
  return args;
}

function usage(problem: string): never {
  console.error(`✖ ${problem}\n\nusage: node scripts/template-verify.mjs (--id <ns/name> … | --all) [--format all|<value>] [--no-presets]\n` +
    '                                         [--thumb --frame N] [--backdrop none|checker|soft|dark|warm] [--scale 0.5]');
  process.exit(2);
}

// ─── reporting ───────────────────────────────────────────────────────────────

let failures = 0;
const pass = (msg: string) => console.log(`  ok    ${msg}`);
const warn = (msg: string) => console.log(`  warn  ${msg}`);
const fail = (msg: string) => { failures += 1; console.log(`  FAIL  ${msg}`); };

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();

// ─── one format of one template ─────────────────────────────────────────────

interface Look {
  id: string;
  values: Record<string, string | number | boolean>;
}

async function verifyFormat(
  server: VerifyServer,
  template: InstalledTemplate,
  format: TemplateFormatOption | null,
  looks: Look[],
  opts: { frame: number | null; backdrop: TemplateBackdrop | null; scale: number; output: (look: Look) => string; jpegQuality: number },
): Promise<void> {
  const { manifest } = template;
  const label = format ? `${format.value} ${format.width}×${format.height}` : 'no formats';
  console.log(`\n${manifest.id} · ${label}`);

  const workRoot = path.join(TEMP, 'work');
  const staged = await stageTemplate(template, format?.value, workRoot);
  const renderEntry = await materializeAbsoluteStaticFiles(staged.entryPath, server.url);
  const wrapper = await generateWrapper(renderEntry, { fontProxyBaseUrl: server.url });
  let bundlePath: string;
  try {
    if (opts.backdrop && opts.backdrop !== 'none') {
      await addBackdropToWrapper(wrapper.wrapperPath, opts.backdrop, format ?? wrapper.config);
    }
    const started = Date.now();
    bundlePath = await bundle({
      entryPoint: wrapper.wrapperPath,
      outDir: path.join(TEMP, 'bundles', `${manifest.id.replace('/', '-')}-${format?.value ?? 'default'}`),
      rootDir: REPO,
      enableCaching: false,
      webpackOverride: (config) => ({
        ...config,
        resolve: { ...config.resolve, modules: [...(config.resolve?.modules ?? ['node_modules']), path.join(REPO, 'node_modules')] },
      }),
    });
    pass(`bundled in ${Math.round((Date.now() - started) / 1000)} s`);
  } finally {
    await cleanupWrapper(wrapper.wrapperPath);
  }
  server.setBundle(bundlePath);

  const compositions = await getCompositions(server.url, { inputProps: buildInputProps(manifest, defaultValues(manifest), format) });
  const comp = compositions[0];
  if (!comp) {
    fail('the bundle registers no composition');
    return;
  }
  if (format && (comp.width !== format.width || comp.height !== format.height)) {
    fail(`bundle reports ${comp.width}×${comp.height}, the format is ${format.width}×${format.height}`);
  } else {
    pass(`canvas ${comp.width}×${comp.height} @${comp.fps} fps, ${comp.durationInFrames} frames`);
  }
  const frame = opts.frame ?? comp.durationInFrames - 1;
  if (frame < 0 || frame >= comp.durationInFrames) {
    fail(`frame ${frame} is outside 0–${comp.durationInFrames - 1}`);
    return;
  }

  for (const look of looks) {
    server.assetHits.length = 0;
    server.fontHits.length = 0;
    const inputProps = buildInputProps(manifest, look.values, format);
    const output = opts.output(look);
    await fs.mkdir(path.dirname(output), { recursive: true });
    const errors: string[] = [];
    const problems: string[] = [];
    try {
      await renderStill({
        serveUrl: server.url,
        composition: { ...comp, defaultProps: {}, props: inputProps },
        inputProps,
        frame,
        output,
        imageFormat: 'jpeg',
        jpegQuality: opts.jpegQuality,
        scale: opts.scale,
        chromiumOptions: { disableWebSecurity: true },
        onBrowserLog: (log) => { if (log.type === 'error') errors.push(log.text); },
      });
    } catch (err) {
      // Remotion's <Img> cancels the render on a failed load — report it with
      // the request that caused it rather than dying on the first bad look.
      problems.push(`render threw: ${(err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 160)}`);
    }

    for (const control of manifest.controls) {
      const value = inputProps[control.key];
      if (control.type !== 'image' || typeof value !== 'string' || value === '') continue;
      const absolute = /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value) ? value : path.join(staged.workDir, value);
      const hit = server.assetHits.find((h) => norm(h.path) === norm(absolute));
      if (!hit) problems.push(`${control.key} = ${value} was never requested at frame ${frame}`);
      else if (hit.status !== 200) problems.push(`${control.key} = ${value} → ${hit.status}`);
    }
    for (const hit of server.assetHits.filter((h) => h.status !== 200)) {
      if (!problems.some((p) => p.includes(String(hit.status)))) problems.push(`/asset ${hit.status} ${hit.path}`);
    }
    const rel = path.relative(REPO, output);
    if (problems.length > 0) fail(`${look.id}: ${problems.join('; ')}  (${rel})`);
    else pass(`${look.id}: f${frame} → ${rel}${server.assetHits.length ? `  (${server.assetHits.length} asset request(s), all 200)` : ''}`);
    const badFonts = server.fontHits.filter((h) => h.status !== 200);
    if (server.fontHits.length > 0) {
      if (badFonts.length > 0) warn(`${look.id}: ${badFonts.length} of ${server.fontHits.length} font request(s) failed — is this machine online?`);
    }
    for (const e of errors.slice(0, 3)) warn(`${look.id}: browser error: ${e.slice(0, 200)}`);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await fs.rm(path.join(TEMP, 'work'), { recursive: true, force: true });
  await fs.rm(path.join(TEMP, 'bundles'), { recursive: true, force: true });

  const templates = await scanTemplates(
    { builtinDir: path.join(REPO, 'resources', 'templates'), userDir: path.join(TEMP, 'no-user-templates') },
  );
  const chosen = args.all ? templates : args.ids.map((id) => {
    const t = templates.find((x) => x.manifest.id === id);
    if (!t) usage(`${id} is not a usable built-in (scan found: ${templates.map((x) => x.manifest.id).join(', ')})`);
    return t;
  });

  const server = await startVerifyServer();
  try {
    for (const template of chosen) {
      const { manifest } = template;
      const backdrop = args.backdrop ?? (manifest.overlay ? DEFAULT_OVERLAY_BACKDROP : null);
      const defaults: Look = { id: 'defaults', values: defaultValues(manifest) };

      if (args.thumb) {
        const options = manifest.formats?.options ?? [];
        const wide = options.find((o) => o.width * 9 === o.height * 16) ?? options.find((o) => o.value === manifest.formats?.default) ?? null;
        if (!wide) {
          fail(`${manifest.id}: no 16:9 format to make a thumbnail from`);
          continue;
        }
        const thumb = path.join(template.dir, manifest.thumbnail ?? 'thumb.jpg');
        await verifyFormat(server, template, wide, [defaults], {
          frame: args.frame,
          backdrop,
          scale: 640 / wide.width,
          jpegQuality: 86,
          output: () => thumb,
        });
        continue;
      }

      const formats = manifest.formats
        ? manifest.formats.options.filter((o) => args.format === 'all' || o.value === args.format)
        : [null];
      if (formats.length === 0) {
        fail(`${manifest.id}: no format "${args.format}"`);
        continue;
      }
      const looks = [defaults, ...(args.presets ? manifest.presets.map((p) => ({ id: p.id, values: applyPreset(defaults.values, p) })) : [])];
      for (const format of formats) {
        await verifyFormat(server, template, format, looks, {
          frame: args.frame,
          backdrop,
          scale: args.scale,
          jpegQuality: 80,
          output: (look) => path.join(TEMP, 'out', manifest.id.replace('/', '-'), `${format?.value ?? 'default'}-${look.id}.jpg`),
        });
      }
    }
  } finally {
    server.close();
  }

  console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
