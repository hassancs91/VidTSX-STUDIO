// The two rewrites a template's source gets when staged: the canvas into
// `compositionConfig`, and `staticFile(` onto the local asset route. The
// emitted helper is EXECUTED here, not just string-matched — it is code inside
// a string inside a template literal, and that is two chances to mis-escape.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ASSET_HELPER_NAME, applyCanvasToConfig, rewriteStaticFiles, stageTemplateSource } from './stage-source';
import { parseCompositionConfig } from '../../main/services/composition-config-parser';

const ONE_LINE = "export const compositionConfig = { id: 'x', fps: 30, durationInFrames: 300, width: 1920, height: 1080 };";
const MULTI_LINE = [
  'export const compositionConfig = {',
  "  id: 'youtube-subs',",
  '  fps: 30,',
  '  durationInFrames: 300,',
  '  width: 1920, // landscape',
  '  height: 1080,',
  '};',
].join('\n');

describe('applyCanvasToConfig', () => {
  it('rewrites width and height and leaves the rest byte-identical', () => {
    const out = applyCanvasToConfig(`// head\n${ONE_LINE}\nconst after = 1920;`, { width: 1080, height: 1920 });
    expect(out).toBe(
      "// head\nexport const compositionConfig = { id: 'x', fps: 30, durationInFrames: 300, width: 1080, height: 1920 };\nconst after = 1920;",
    );
  });

  it('produces a literal the app’s own parser reads back', () => {
    for (const source of [ONE_LINE, MULTI_LINE, `${ONE_LINE.slice(0, -1)} as const;`]) {
      const out = applyCanvasToConfig(source, { width: 1080, height: 1080 });
      expect(out).not.toBeNull();
      const config = parseCompositionConfig(out as string);
      expect(config).toMatchObject({ width: 1080, height: 1080, fps: 30, durationInFrames: 300 });
    }
  });

  it('adds a missing key', () => {
    const out = applyCanvasToConfig("export const compositionConfig = { id: 'x', fps: 30, };", { width: 1080, height: 1920 });
    expect(parseCompositionConfig(out as string)).toMatchObject({ id: 'x', width: 1080, height: 1920 });
  });

  it('returns null when there is no plain config literal', () => {
    expect(applyCanvasToConfig('export default function A() { return null; }', { width: 1, height: 1 })).toBeNull();
  });
});

/** Strip the helper's type annotations and run it against a fake `window`. */
function runHelper(staged: string, origin: string): (p: string) => string {
  const start = staged.indexOf(`function ${ASSET_HELPER_NAME}`);
  const js = staged.slice(start).replace('(p: string): string', '(p)');
  const factory = new Function('window', `${js}\nreturn ${ASSET_HELPER_NAME};`) as (w: unknown) => (p: string) => string;
  return factory({ location: { origin } });
}

describe('rewriteStaticFiles', () => {
  const source = [
    "import { Img, staticFile } from 'remotion';",
    'export default function A({ avatar }: { avatar: string }) {',
    '  return <Img src={staticFile(avatar)} alt={Remotion.staticFile("x")} />;',
    '}',
  ].join('\n');

  it('rewrites bare calls only — not the import, not a member call', () => {
    const out = rewriteStaticFiles(source, 'C:/work/t');
    expect(out).toContain("import { Img, staticFile } from 'remotion';");
    expect(out).toContain(`src={${ASSET_HELPER_NAME}(avatar)}`);
    expect(out).toContain('Remotion.staticFile("x")');
  });

  it('appends the helper, so every original line keeps its number', () => {
    const out = rewriteStaticFiles(source, 'C:/work/t');
    const before = source.split('\n');
    expect(out.split('\n').slice(0, before.length).map((l) => l.replace(ASSET_HELPER_NAME, 'staticFile'))).toEqual(before);
  });

  it('leaves a file without staticFile untouched', () => {
    const plain = 'export default function A() { return null; }';
    expect(rewriteStaticFiles(plain, 'C:/work/t')).toBe(plain);
  });

  it('emits a helper that resolves every kind of path', () => {
    const asset = runHelper(rewriteStaticFiles(source, 'C:\\work\\t\\'), 'http://127.0.0.1:3210');
    const url = (abs: string) => `http://127.0.0.1:3210/asset?path=${encodeURIComponent(abs)}`;
    expect(asset('assets/bg.jpg')).toBe(url('C:/work/t/assets/bg.jpg'));
    expect(asset('./assets/bg.jpg')).toBe(url('C:/work/t/assets/bg.jpg'));
    expect(asset('D:\\pics\\me.png')).toBe(url('D:\\pics\\me.png'));
    expect(asset('D:/pics/me.png')).toBe(url('D:/pics/me.png'));
    expect(asset('/home/x/me.png')).toBe(url('/home/x/me.png'));
    expect(asset('\\\\nas\\share\\me.png')).toBe(url('\\\\nas\\share\\me.png'));
    expect(asset('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(asset('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});

describe('stageTemplateSource on the built-in templates', () => {
  const root = path.resolve(__dirname, '../../../resources/templates');
  const entries: string[] = [];
  for (const namespace of fs.readdirSync(root)) {
    for (const name of fs.readdirSync(path.join(root, namespace))) {
      entries.push(path.join(root, namespace, name, 'composition.tsx'));
    }
  }

  it.each(entries)('%s stages to a portrait canvas with no staticFile call left', (file) => {
    const staged = stageTemplateSource(fs.readFileSync(file, 'utf-8'), {
      canvas: { width: 1080, height: 1920 },
      assetDir: 'C:/work/t',
    });
    expect(staged).not.toBeNull();
    expect(parseCompositionConfig(staged as string)).toMatchObject({ width: 1080, height: 1920 });
    expect(staged).not.toMatch(/(?<![.\w$])staticFile\s*\(/);
  });
});
