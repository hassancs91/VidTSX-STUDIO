import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { requireUrl } from './vidtsx-assets';

describe('@vidtsx/assets', () => {
  it('names an empty URL instead of fetching nothing', () => {
    expect(() => requireUrl('', 'useModel')).toThrow('useModel: the URL is empty');
    expect(requireUrl('http://x/asset-root/t/a.glb', 'useModel')).toBe('http://x/asset-root/t/a.glb');
  });

  it('never spells a staticFile call in the built-in sources (the bundle step would read it as a file the piece loads)', () => {
    for (const file of ['vidtsx-assets.ts', 'vidtsx-three-assets.ts', 'vidtsx-sim.ts']) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf-8');
      expect(source, file).not.toMatch(/\bstaticFile\d*\(/);
    }
  });
});
