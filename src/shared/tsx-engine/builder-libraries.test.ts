import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  BANNED_LIBRARIES,
  BUILDER_LIBRARIES,
  bannedLibraryReason,
  builderLibraryCatalogue,
  isBuilderLibrary,
  isPhysicsEngine,
  isWebGlLibrary,
  packageNameOf,
} from './builder-libraries';

describe('builder library set', () => {
  it('allows every package in the set, its subpaths, the d3 modules and @remotion/*', () => {
    for (const lib of BUILDER_LIBRARIES) expect(isBuilderLibrary(lib.name), lib.name).toBe(true);
    expect(isBuilderLibrary('@remotion/google-fonts/Poppins')).toBe(true);
    expect(isBuilderLibrary('world-atlas/countries-110m.json')).toBe(true);
    expect(isBuilderLibrary('d3-scale')).toBe(true);
    expect(isBuilderLibrary('d3-geo')).toBe(true);
    expect(isBuilderLibrary('@remotion/media-utils')).toBe(true);
    expect(isBuilderLibrary('remotion/no-react')).toBe(true);
  });

  it('refuses what is not installed, and what animates on its own clock, with the reason', () => {
    expect(isBuilderLibrary('lodash')).toBe(false);
    expect(isBuilderLibrary('threejs')).toBe(false);
    expect(isBuilderLibrary('d3x')).toBe(false);
    for (const banned of BANNED_LIBRARIES) {
      expect(isBuilderLibrary(banned.name), banned.name).toBe(false);
      expect(bannedLibraryReason(banned.name)).toMatch(/clock/);
    }
    expect(bannedLibraryReason('@react-spring/web')).toMatch(/clock/);
    expect(bannedLibraryReason('gsap/ScrollTrigger')).toMatch(/clock/);
    expect(bannedLibraryReason('d3-scale')).toBeNull();
  });

  it('names packages the way npm does', () => {
    expect(packageNameOf('@remotion/google-fonts/Inter')).toBe('@remotion/google-fonts');
    expect(packageNameOf('world-atlas/countries-110m.json')).toBe('world-atlas');
  });

  it('electron-builder.yml unpacks every package the set pulls in (node scripts/builder-unpack.mjs --write)', () => {
    const root = path.resolve(__dirname, '../../..');
    const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'builder-unpack.mjs'), '--check'], { encoding: 'utf-8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('lists only packages that are installed and declared as dependencies', () => {
    const root = path.resolve(__dirname, '../../..');
    const pkg = createRequire(path.join(root, 'package.json'))('./package.json') as { dependencies: Record<string, string> };
    for (const lib of BUILDER_LIBRARIES.filter((l) => !l.builtIn)) expect(pkg.dependencies[lib.name], lib.name).toBeTruthy();
  });

  it('tells the 3D libraries (a WebGL canvas) from the rest', () => {
    for (const pkg of ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing', '@remotion/three']) {
      expect(isWebGlLibrary(pkg), pkg).toBe(true);
    }
    for (const pkg of ['d3', 'roughjs', '@dimforge/rapier3d-compat', '@vidtsx/three-assets', 'three-stdlib']) {
      expect(isWebGlLibrary(pkg), pkg).toBe(false);
    }
  });

  it('ships the frame-pure simulation helper as a built-in, and tells engines from it', () => {
    const sim = BUILDER_LIBRARIES.find((l) => l.name === '@vidtsx/sim');
    expect(sim?.builtIn).toBe(true);
    expect(isBuilderLibrary('@vidtsx/sim')).toBe(true);
    expect(isPhysicsEngine('@vidtsx/sim')).toBe(false);
    for (const engine of ['@dimforge/rapier3d-compat', '@dimforge/rapier2d-compat', 'cannon-es', 'matter-js', 'planck']) {
      expect(isPhysicsEngine(engine), engine).toBe(true);
    }
    expect(isPhysicsEngine('d3-force')).toBe(false);
    // Every engine line sends the builder through the helper.
    for (const lib of BUILDER_LIBRARIES.filter((l) => l.area === 'physics' && !l.builtIn && l.name !== '@dimforge/rapier2d-compat')) {
      expect(lib.use, lib.name).toContain('@vidtsx/sim');
    }
  });

  it('gives the prompt one line per package, grouped by area', () => {
    const catalogue = builderLibraryCatalogue();
    for (const lib of BUILDER_LIBRARIES) expect(catalogue).toContain(`\`${lib.name}\`: `);
    expect(catalogue).toContain('### 3D');
    expect(catalogue).toContain('### Physics');
  });
});
