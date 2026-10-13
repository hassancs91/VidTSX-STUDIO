import { describe, expect, it } from 'vitest';
import { dreiImports, findNetworkHelpers, openingTags } from './build-offline';

const piece = (imports: string, body: string) => `${imports}\nexport default function Piece() {\n  return (${body});\n}\n`;

describe('dreiImports', () => {
  it('reads named, aliased, type-only and namespace imports, multi-line', () => {
    const source = [
      "import { RoundedBox, Text as Label, type Vector3Tuple,",
      "  Environment } from '@react-three/drei';",
      "import * as drei from '@react-three/drei';",
      "import type { Props } from '@react-three/drei';",
      "import { Text } from 'somewhere-else';",
    ].join('\n');
    const { named, namespaces } = dreiImports(source);
    expect([...named]).toEqual([
      ['RoundedBox', 'RoundedBox'],
      ['Label', 'Text'],
      ['Environment', 'Environment'],
    ]);
    expect(namespaces).toEqual(['drei']);
  });
});

describe('openingTags', () => {
  it('reads a tag whose attributes hold arrow functions and strings with >', () => {
    const source = '<Clouds limit={10} onUpdate={(c) => c.x > 1} label="a > b" texture={tex}><Cloud /></Clouds>';
    expect(openingTags(source, 'Clouds')).toEqual(['<Clouds limit={10} onUpdate={(c) => c.x > 1} label="a > b" texture={tex}>']);
    expect(openingTags(source, 'Cloud')).toEqual(['<Cloud />']);
  });
});

describe('findNetworkHelpers', () => {
  it('passes a piece with no drei, or with drei helpers that stay local', () => {
    expect(findNetworkHelpers(piece("import React from 'react';", '<div />'), 'index.tsx')).toEqual([]);
    const local = piece(
      "import { RoundedBox, ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei';",
      '<><RoundedBox /><ContactShadows /><Environment resolution={256}><Lightformer intensity={2} /></Environment></>',
    );
    expect(findNetworkHelpers(local, 'index.tsx')).toEqual([]);
  });

  it('refuses an Environment preset, as JSX or through the hook', () => {
    const jsx = piece("import { Environment } from '@react-three/drei';", '<Environment preset="city" background />');
    expect(findNetworkHelpers(jsx, 'scene.tsx')).toEqual([expect.stringMatching(/^scene\.tsx: drei's Environment `preset` downloads/)]);
    const hook = "import { useEnvironment } from '@react-three/drei';\nconst env = useEnvironment({ preset: 'sunset' });";
    expect(findNetworkHelpers(hook, 'index.tsx')).toHaveLength(1);
    const files = "import { useEnvironment } from '@react-three/drei';\nconst env = useEnvironment({ files: url });";
    expect(findNetworkHelpers(files, 'index.tsx')).toEqual([]);
  });

  it('refuses clouds unless <Clouds> carries a texture, aliases and namespaces included', () => {
    const bare = piece("import { Cloud } from '@react-three/drei';", '<Cloud segments={20} />');
    expect(findNetworkHelpers(bare, 'index.tsx')).toEqual([expect.stringContaining('cloud image from a CDN')]);
    const wrapped = piece(
      "import { Cloud, Clouds as Sky } from '@react-three/drei';",
      "<Sky texture={staticFile('cloud.png')}><Cloud /></Sky>",
    );
    expect(findNetworkHelpers(wrapped, 'index.tsx')).toEqual([]);
    const ns = piece("import * as drei from '@react-three/drei';", '<drei.Clouds><drei.Cloud /></drei.Clouds>');
    expect(findNetworkHelpers(ns, 'index.tsx')).toHaveLength(1);
  });

  it('refuses the always-fetching helpers on import, one error each', () => {
    const source = piece(
      "import { Text, Text3D, useMatcapTexture, useKTX2 } from '@react-three/drei';",
      '<Text>hi</Text>',
    );
    const errors = findNetworkHelpers(source, 'index.tsx');
    expect(errors).toHaveLength(4);
    expect(errors[0]).toMatch(/matcap/);
    expect(errors.some((e) => e.includes('troika'))).toBe(true);
    expect(errors.some((e) => e.includes('Text3D'))).toBe(true);
    expect(errors.some((e) => e.includes('KTX2'))).toBe(true);
  });

  it('does not take a namespace member with a longer name for the helper', () => {
    const source = piece("import * as drei from '@react-three/drei';", '<drei.TextureLoaderThing /><drei.RoundedBox />');
    expect(findNetworkHelpers(source, 'index.tsx')).toEqual([]);
  });
});
