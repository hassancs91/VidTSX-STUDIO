// The preview's shared-instance map: remotion's subpaths must come from the
// Player's copy (END_TO_END_PLAN T7), never from the CDN.
import { describe, expect, it } from 'vitest';
import { REMOTION_SUBPATHS } from '../../shared/studio/shot-lint';
import { virtualModuleFile } from './virtual-module-files';

describe('virtualModuleFile', () => {
  it('serves react, react-dom, the jsx runtimes and remotion from the virtual modules', () => {
    expect(virtualModuleFile('react')).toBe('react.js');
    expect(virtualModuleFile('react-dom')).toBe('react-dom.js');
    expect(virtualModuleFile('react/jsx-runtime')).toBe('react-jsx-runtime.js');
    expect(virtualModuleFile('remotion')).toBe('remotion.js');
  });

  it('serves every remotion subpath a shot may import from the module server routes', () => {
    expect(virtualModuleFile('remotion/no-react')).toBe('remotion.js/no-react');
    expect(virtualModuleFile('remotion/version')).toBe('remotion.js/version');
    for (const spec of REMOTION_SUBPATHS) expect(virtualModuleFile(spec)).toBeDefined();
  });

  it('leaves everything else to the CDN path', () => {
    expect(virtualModuleFile('@remotion/google-fonts/Inter')).toBeUndefined();
    expect(virtualModuleFile('remotion/foo')).toBeUndefined();
    expect(virtualModuleFile('toString')).toBeUndefined();
  });
});
