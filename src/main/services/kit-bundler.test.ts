import { describe, it, expect } from 'vitest';
import path from 'path';
import { bundleKitFromDir } from './kit-bundler';

const REPO_KIT_DIR = path.resolve(__dirname, '../../../resources/shot-kit/core');
const BASE_URL = 'http://127.0.0.1:3200';

// Integrity gate for the SHIPPED pack: the exact bytes in resources/ must
// bundle, expose the Q4 roster, and resolve externals to the module server's
// virtual URLs. A pack that fails here would 404 in every preview.
describe('bundleKitFromDir (shipped core pack)', () => {
  it('bundles the shipped pack and exposes the Q4 roster', async () => {
    const bundle = await bundleKitFromDir(REPO_KIT_DIR, BASE_URL);
    expect(bundle).not.toBeNull();
    expect(bundle!.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const name of [
      'BrowserWindow',
      'VSCodeWindow',
      'TerminalWindow',
      'GenericWindow',
      'TypedText',
      'AgentFeed',
      'StatBlock',
      'EASINGS',
    ]) {
      expect(bundle!.code, `bundle should export ${name}`).toContain(name);
    }
  });

  it('rewrites every external to a virtual module URL (no bare specifiers left)', async () => {
    const bundle = await bundleKitFromDir(REPO_KIT_DIR, BASE_URL);
    expect(bundle!.code).not.toMatch(/from\s*['"](?:react|remotion)(?:\/[^'"]*)?['"]/);
    expect(bundle!.code).toContain(`${BASE_URL}/virtual/remotion.js`);
    expect(bundle!.code).toContain(`${BASE_URL}/virtual/react`);
  });

  it('returns null for a missing pack dir (degrade, not throw)', async () => {
    const bundle = await bundleKitFromDir(path.join(REPO_KIT_DIR, 'nope'), BASE_URL);
    expect(bundle).toBeNull();
  });
});
