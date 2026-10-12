// The Import TSX bundle step, run for real: esbuild over temp files, then the
// same lint the shot gate uses. A multi-file shot becomes one file that
// imports only react/remotion; staticFile() calls become `assets` lookups and
// their files are found under public/; a package outside the allowlist, a
// media import and a computed config are refused with a pointed message.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { parseCompositionConfig } from '../composition-config-parser';
import { bundleShotSource, resolveShotMedia } from './shot-bundle';
import { finishShotBundle, shotAssetKey } from './shot-bundle-finish';

let root = '';
const write = async (rel: string, text: string) => {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
  return file;
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-shot-bundle-'));
  await write('project/src/lib/theme.ts', "export const INK = '#181825';\nexport const pad = (n: number) => n * 8;\n");
  await write(
    'project/src/lib/Card.tsx',
    "import React from 'react';\nimport { INK, pad } from './theme';\nexport const Card: React.FC<{ title: string }> = ({ title }) => <div style={{ color: INK, padding: pad(2) }}>{title}</div>;\n",
  );
  await write('project/public/book/page-67.png', 'png');
  await write(
    'project/src/shots/B2NameCard.tsx',
    [
      "import React from 'react';",
      "import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';",
      "import { Card } from '../lib/Card';",
      "const PAGE = staticFile('book/page-67.png');",
      "const MISSING = staticFile('book/not-there.png');",
      'export const compositionConfig = { id: "B2NameCard", durationInFrames: 90, fps: 30, width: 1920, height: 1080 };',
      'const B2NameCard: React.FC = () => {',
      '  const frame = useCurrentFrame();',
      '  return <AbsoluteFill><Img src={PAGE} /><Img src={MISSING} /><Card title={String(frame)} /></AbsoluteFill>;',
      '};',
      'export default B2NameCard;',
    ].join('\n'),
  );
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('bundleShotSource', () => {
  it('turns a multi-file shot into one file the shot lint accepts', async () => {
    const result = await bundleShotSource(path.join(root, 'project/src/shots/B2NameCard.tsx'));
    expect(lintShotSource(result.code)).toEqual({ ok: true, errors: [] });
    expect(parseCompositionConfig(result.code)).toMatchObject({ id: 'B2NameCard', durationInFrames: 90, fps: 30, width: 1920, height: 1080 });
    expect(result.inlinedFiles).toEqual(['../lib/Card.tsx', '../lib/theme.ts']);
    expect(result.inlinedPackages).toEqual([]);
    // No file path survives; the body runs lazily behind the assets prop.
    expect(result.code).not.toContain('staticFile(');
    expect(result.code).toContain('__vidtsxAsset("book/page-67.png")');
    expect(result.code).toContain('function __vidtsxInit() {');
    expect(result.code).toMatch(/export default __vidtsxShot;\s*$/);
  });

  it('reports each literal staticFile() with its key and the file under public/', async () => {
    const result = await bundleShotSource(path.join(root, 'project/src/shots/B2NameCard.tsx'));
    expect(result.media).toEqual([
      { key: 'book_page_67', ref: 'book/page-67.png', path: path.join(root, 'project', 'public', 'book', 'page-67.png') },
      { key: 'book_not_there', ref: 'book/not-there.png', path: null },
    ]);
    expect(result.dynamicStaticFileCalls).toBe(0);
  });

  it('refuses a package outside the allowlist by name', async () => {
    const file = await write('project/src/shots/Bad.tsx', "import _ from 'lodash';\nexport const compositionConfig = { id: 'x', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => _.noop();\n");
    await expect(bundleShotSource(file)).rejects.toThrow(/Package "lodash" is not available to shots/);
  });

  it('refuses a library that animates on its own clock, naming the reason, even when not installed', async () => {
    const file = await write('project/src/shots/Gsap.tsx', "import gsap from 'gsap';\nexport const compositionConfig = { id: 'x', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => gsap.to({}, {});\n");
    await expect(bundleShotSource(file)).rejects.toThrow(/Package "gsap" is refused: it animates on its own clock/);
  });

  it('inlines a package from the library set and leaves only react/remotion imports', async () => {
    const file = await write(
      'project/src/shots/Rough.tsx',
      "import React from 'react';\nimport rough from 'roughjs';\nexport const compositionConfig = { id: 'Rough', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nconst d = rough.generator().toPaths(rough.generator().rectangle(10, 10, 80, 80, { seed: 7 }))[0].d;\nexport default () => <svg><path d={d} /></svg>;\n",
    );
    const bundled = await bundleShotSource(file, { nodePaths: [path.resolve(__dirname, '../../../../node_modules')] });
    expect(bundled.inlinedPackages).toContain('roughjs');
    expect(lintShotSource(bundled.code).errors).toEqual([]);
  }, 30_000);

  it('serves require("react") inside CommonJS dependencies from the shared react, never a dynamic require', async () => {
    const file = await write(
      'project/src/shots/CjsDeps.tsx',
      [
        "import React from 'react';",
        "import { Star } from '@remotion/shapes';", // imports react-dom, which require()s react
        "import { Canvas } from '@react-three/fiber';", // zustand → use-sync-external-store require()s react
        "export const compositionConfig = { id: 'CjsDeps', durationInFrames: 30, fps: 30, width: 100, height: 100 };",
        'export default () => <div><Star points={5} innerRadius={10} outerRadius={20} />{String(typeof Canvas)}</div>;',
      ].join('\n'),
    );
    const bundled = await bundleShotSource(file, { nodePaths: [path.resolve(__dirname, '../../../../node_modules')] });
    expect(bundled.code).not.toMatch(/__require\("(react|remotion)"\)/);
    expect(bundled.code).not.toContain('process.env.NODE_ENV');
    expect(lintShotSource(bundled.code).errors).toEqual([]);
  }, 30_000); // bundles R3F + shapes for real: ~1 s alone, slower under the full suite

  it('inlines the built-in @vidtsx/sim from its embedded source, with no node_modules to search', async () => {
    const file = await write(
      'project/src/shots/Sim.tsx',
      [
        "import React from 'react';",
        "import { useSimulation } from '@vidtsx/sim';",
        "export const compositionConfig = { id: 'Sim', durationInFrames: 30, fps: 30, width: 100, height: 100 };",
        'export default () => {',
        "  const y = useSimulation({ id: 'drop', setup: () => ({ y: 1 }), step: (w, { dt }) => { w.y -= dt; }, read: (w) => w.y });",
        '  return <div>{String(y)}</div>;',
        '};',
      ].join('\n'),
    );
    const bundled = await bundleShotSource(file);
    expect(bundled.inlinedPackages).toEqual(['@vidtsx/sim']);
    expect(bundled.code).not.toContain('@vidtsx/sim"');
    expect(bundled.code).toContain('function createFrameSim');
    expect(lintShotSource(bundled.code).errors).toEqual([]);
  });

  it('refuses a media or stylesheet import and says what to do instead', async () => {
    const file = await write('project/src/shots/Css.tsx', "import './x.css';\nexport const compositionConfig = { id: 'x', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => null;\n");
    await expect(bundleShotSource(file)).rejects.toThrow(/is not code — a shot cannot import media or stylesheets/);
  });

  it('refuses a computed compositionConfig instead of evaluating it', async () => {
    const file = await write('project/src/shots/Computed.tsx', "const FPS = 30;\nexport const compositionConfig = { id: 'x', durationInFrames: FPS * 3, fps: FPS, width: 100, height: 100 };\nexport default () => null;\n");
    await expect(bundleShotSource(file)).rejects.toThrow(/not a plain object of literal numbers/);
  });
});

describe('helpers', () => {
  it('shotAssetKey matches the runtime rule', () => {
    expect(shotAssetKey('/book/page-67.png')).toBe('book_page_67');
    expect(shotAssetKey('logos/Acme Logo@2x.svg')).toBe('logos_Acme_Logo_2x');
  });

  it('resolveShotMedia finds public/ in an ancestor and nothing outside it', () => {
    const source = path.join(root, 'project/src/shots/B2NameCard.tsx');
    expect(resolveShotMedia(source, 'book/page-67.png')).toBe(path.join(root, 'project', 'public', 'book', 'page-67.png'));
    expect(resolveShotMedia(source, 'nope.png')).toBeNull();
  });

  it('a module-scope media lookup follows a changed assets prop', () => {
    const bundled = [
      'import { staticFile } from "remotion";',
      'var compositionConfig = { id: "m", durationInFrames: 30, fps: 30, width: 10, height: 10 };',
      'var LOGO = staticFile("brand/logo.svg");',
      'var Shot = () => LOGO;',
      'export {',
      '  compositionConfig,',
      '  Shot as default',
      '};',
    ].join('\n');
    // Run the finished module with a createElement that renders on the spot.
    const runnable = finishShotBundle(bundled)
      .code.replace(/^import .*$/gm, '')
      .replace(/^export const /m, 'const ')
      .replace(/^export default (\w+);\s*$/m, 'return $1;');
    const shot = new Function('__vidtsxCreateElement', runnable)(
      (type: (props: unknown) => unknown, props: unknown) => type(props),
    ) as (props: { assets: Record<string, string> }) => string;
    expect(shot({ assets: { brand_logo: '/asset?path=a.svg' } })).toBe('/asset?path=a.svg');
    expect(shot({ assets: { brand_logo: '/asset?path=b.svg' } })).toBe('/asset?path=b.svg');
    expect(shot({ assets: {} })).toBe('');
  });

  it('finishShotBundle counts a non-literal staticFile() as dynamic', () => {
    const bundled = [
      'import { staticFile } from "remotion";',
      'var compositionConfig = { id: "d", durationInFrames: 30, fps: 30, width: 10, height: 10 };',
      'var name = "a";',
      'var Shot = () => staticFile(`imgs/${name}.png`);',
      'export {',
      '  compositionConfig,',
      '  Shot as default',
      '};',
    ].join('\n');
    const finished = finishShotBundle(bundled);
    expect(finished.mediaRefs).toEqual([]);
    expect(finished.dynamicStaticFileCalls).toBe(1);
  });
});
