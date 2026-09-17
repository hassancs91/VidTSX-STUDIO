// The working copy: staged per format, install folder untouched, artwork
// mirrored, state round-tripped. Also the two-root scan's shadowing rule.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), isPackaged: false, getAppPath: () => os.tmpdir(), getVersion: () => '1.1.0' },
}));

import { parseCompositionConfig } from '../composition-config-parser';
import { transpileTsx } from '../tsx-transpiler';
import { loadTemplateState, saveTemplateState, stageTemplate } from './template-stage';
import { scanTemplates } from './template-store';

const SOURCE = [
  "import { Img, staticFile } from 'remotion';",
  "export const compositionConfig = { id: 'card', fps: 30, durationInFrames: 90, width: 1920, height: 1080 };",
  'export default function Card({ logo = "" }: { logo?: string }) {',
  '  return logo ? <Img src={staticFile(logo)} /> : null;',
  '}',
].join('\n');

function manifest(version: string, id = 'acme/card') {
  return {
    formatVersion: 1,
    id,
    name: 'Card',
    version,
    author: { name: 'Acme' },
    minAppVersion: '1.0.0',
    category: 'titles',
    formats: {
      prop: 'format',
      default: 'landscape',
      options: [
        { value: 'landscape', label: '16:9', width: 1920, height: 1080 },
        { value: 'portrait', label: '9:16', width: 1080, height: 1920 },
      ],
    },
    controls: [{ key: 'logo', label: 'Logo', type: 'image', default: '' }],
  };
}

let root: string;
let builtinDir: string;
let userDir: string;
let workRoot: string;

async function writeTemplate(base: string, version: string): Promise<string> {
  const dir = path.join(base, 'acme', 'card');
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(dir, 'template.json'), JSON.stringify(manifest(version)), 'utf-8');
  await fs.writeFile(path.join(dir, 'composition.tsx'), SOURCE, 'utf-8');
  await fs.writeFile(path.join(dir, 'assets', 'logo.png'), 'png-bytes', 'utf-8');
  return dir;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-stage-test-'));
  builtinDir = path.join(root, 'builtin');
  userDir = path.join(root, 'user');
  workRoot = path.join(root, 'work');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('scanTemplates', () => {
  it('finds a built-in and lets only a NEWER user copy shadow it', async () => {
    await writeTemplate(builtinDir, '1.2.0');
    await writeTemplate(userDir, '1.2.0');
    let found = await scanTemplates({ builtinDir, userDir }, '1.1.0');
    expect(found.map((t) => [t.manifest.id, t.origin])).toEqual([['acme/card', 'builtin']]);

    await writeTemplate(userDir, '1.3.0');
    found = await scanTemplates({ builtinDir, userDir }, '1.1.0');
    expect(found.map((t) => [t.manifest.version, t.origin])).toEqual([['1.3.0', 'user']]);
  });

  it('skips a folder whose name does not match its id, and one with no entry file', async () => {
    const dir = await writeTemplate(builtinDir, '1.0.0');
    await fs.rename(dir, path.join(builtinDir, 'acme', 'renamed'));
    expect(await scanTemplates({ builtinDir, userDir }, '1.1.0')).toEqual([]);

    const other = await writeTemplate(userDir, '1.0.0');
    await fs.rm(path.join(other, 'composition.tsx'));
    expect(await scanTemplates({ builtinDir, userDir }, '1.1.0')).toEqual([]);
  });

  it('skips a template that needs a newer app', async () => {
    await writeTemplate(builtinDir, '1.0.0');
    expect(await scanTemplates({ builtinDir, userDir }, '0.9.0')).toEqual([]);
  });
});

describe('stageTemplate', () => {
  it('writes one entry per format with that canvas, and never touches the install folder', async () => {
    const dir = await writeTemplate(builtinDir, '1.0.0');
    const [template] = await scanTemplates({ builtinDir, userDir }, '1.1.0');

    const portrait = await stageTemplate(template, 'portrait', workRoot);
    expect(path.basename(portrait.entryPath)).toBe('card-portrait.tsx');
    const staged = await fs.readFile(portrait.entryPath, 'utf-8');
    expect(parseCompositionConfig(staged)).toMatchObject({ id: 'card', width: 1080, height: 1920 });
    expect(staged).toContain('__vidtsxAsset(logo)');
    expect(staged).toContain(JSON.stringify(portrait.workDir.replace(/\\/g, '/')));

    const landscape = await stageTemplate(template, 'landscape', workRoot);
    expect(landscape.entryPath).not.toBe(portrait.entryPath);
    expect(parseCompositionConfig(await fs.readFile(landscape.entryPath, 'utf-8'))).toMatchObject({ width: 1920, height: 1080 });

    expect(await fs.readFile(path.join(dir, 'composition.tsx'), 'utf-8')).toBe(SOURCE);
    expect((await fs.readdir(dir)).sort()).toEqual(['assets', 'composition.tsx', 'template.json']);
  });

  it('mirrors the bundled artwork so a relative image value resolves', async () => {
    await writeTemplate(builtinDir, '1.0.0');
    const [template] = await scanTemplates({ builtinDir, userDir }, '1.1.0');
    const staged = await stageTemplate(template, undefined, workRoot);
    expect(await fs.readFile(path.join(staged.workDir, 'assets', 'logo.png'), 'utf-8')).toBe('png-bytes');
  });

  it('falls back to the default format for a stale value', async () => {
    await writeTemplate(builtinDir, '1.0.0');
    const [template] = await scanTemplates({ builtinDir, userDir }, '1.1.0');
    expect((await stageTemplate(template, 'cinema', workRoot)).format).toBe('landscape');
  });

  it('does not rewrite an unchanged entry', async () => {
    await writeTemplate(builtinDir, '1.0.0');
    const [template] = await scanTemplates({ builtinDir, userDir }, '1.1.0');
    const first = await stageTemplate(template, 'portrait', workRoot);
    const before = (await fs.stat(first.entryPath)).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await stageTemplate(template, 'portrait', workRoot);
    expect((await fs.stat(first.entryPath)).mtimeMs).toBe(before);
  });
});

describe('the built-in templates through the PREVIEW transpiler', () => {
  // The render bundles with webpack; the preview transpiles with esbuild and
  // rewrites imports onto virtual modules. A staged file has to survive both —
  // this is the preview half, against every template the app really ships.
  const builtinRoot = path.resolve(__dirname, '../../../../resources/templates');

  it('stage in every declared format, transpile, and keep the canvas', async () => {
    const templates = await scanTemplates({ builtinDir: builtinRoot, userDir }, '1.1.0');
    expect(templates.length).toBeGreaterThan(0);

    for (const template of templates) {
      const formats = template.manifest.formats?.options ?? [null];
      const source = await fs.readFile(path.join(template.dir, template.manifest.entry), 'utf-8');
      // A template with no image props never calls staticFile, so gets no helper.
      const usesStaticFile = /(?<![.\w$])staticFile\s*\(/.test(source);
      for (const format of formats) {
        const staged = await stageTemplate(template, format?.value, workRoot);
        const result = await transpileTsx(staged.entryPath, 'http://127.0.0.1:3200');
        const label = `${template.manifest.id} ${format?.value ?? ''}`;
        expect(result.success, `${label}: ${result.success ? '' : result.error}`).toBe(true);
        if (!result.success) continue;
        if (format) expect(result.config, label).toMatchObject({ width: format.width, height: format.height });
        // The helper made it through, and no call still reaches remotion's own staticFile.
        if (usesStaticFile) expect(result.code, label).toContain('function __vidtsxAsset(');
        expect(result.code, label).not.toMatch(/(?<![.\w$])staticFile\s*\(/);
        // Imports were rewritten onto the module server's virtual modules.
        expect(result.code, label).toContain('http://127.0.0.1:3200/');
      }
    }
    // Every built-in × every format goes through the real transpiler, so the run
    // grows with the gallery (~3 s for ten on a quiet machine).
  }, 60_000);
});

describe('template state', () => {
  it('round-trips, and reads as null when absent or corrupt', async () => {
    expect(await loadTemplateState('acme/card', workRoot)).toBeNull();
    const state = { templateVersion: '1.0.0', format: 'portrait', values: { logo: 'D:\\pics\\me.png' } };
    await saveTemplateState('acme/card', state, workRoot);
    expect(await loadTemplateState('acme/card', workRoot)).toEqual(state);

    await fs.writeFile(path.join(workRoot, 'acme', 'card', 'values.json'), '{ not json', 'utf-8');
    expect(await loadTemplateState('acme/card', workRoot)).toBeNull();
  });
});
