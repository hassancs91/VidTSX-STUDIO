// Bundles the shot-kit pack (resources/shot-kit/<packId>/) into the single
// ESM module the module server serves as `/virtual/vidtsx-kit.js` — the
// '@vidtsx/kit' specifier every kit-using shot imports (SHOT_QUALITY_DESIGN
// Q4). esbuild bundles the pack's index.tsx with react/remotion left external,
// then the externals are rewritten to the module server's virtual URLs so the
// kit shares the Player's React/Remotion instances.
//
// Electron-free on purpose (the kit dir arrives as a parameter): vitest runs
// this against the repo's resources/ to prove the shipped pack bundles.
import * as esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('KitBundler');

export interface KitBundle {
  code: string;
  /** Content hash of the pack sources (cache key, not a URL). */
  hash: string;
  /** kitVersion from pack.json ('0.0.0' when unreadable). */
  version: string;
}

let cache: { key: string; bundle: KitBundle } | null = null;

/** The kit's externals resolve to the same virtual modules shot code uses. */
function rewriteKitExternals(code: string, baseUrl: string): string {
  return code
    .replace(/from\s*['"]remotion['"]/g, `from '${baseUrl}/virtual/remotion.js'`)
    .replace(/from\s*['"]react['"]/g, `from '${baseUrl}/virtual/react.js'`)
    .replace(/from\s*['"]react\/jsx-runtime['"]/g, `from '${baseUrl}/virtual/react-jsx-runtime.js'`)
    .replace(/from\s*['"]react\/jsx-dev-runtime['"]/g, `from '${baseUrl}/virtual/react-jsx-runtime.js'`);
}

async function hashKitSources(kitDir: string): Promise<string | null> {
  let names: string[];
  try {
    names = (await fs.readdir(kitDir)).filter((n) => n.endsWith('.tsx') || n === 'pack.json').sort();
  } catch {
    return null;
  }
  if (!names.includes('index.tsx')) return null;
  const hash = createHash('md5');
  for (const name of names) {
    hash.update(name);
    hash.update(await fs.readFile(path.join(kitDir, name), 'utf-8'));
  }
  return hash.digest('hex').slice(0, 12);
}

/** kitVersion from a pack dir's pack.json ('0.0.0' when unreadable). */
export async function readKitPackVersion(kitDir: string): Promise<string> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(kitDir, 'pack.json'), 'utf-8')) as {
      version?: unknown;
    };
    return typeof raw.version === 'string' ? raw.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Bundle the kit pack at `kitDir` for serving at `baseUrl`. Returns null when
 * the pack is missing or fails to build (the kit degrades to absent — the
 * route 404s and the prompt simply omits its KIT section).
 */
export async function bundleKitFromDir(kitDir: string, baseUrl: string): Promise<KitBundle | null> {
  const sourceHash = await hashKitSources(kitDir);
  if (!sourceHash) {
    log.warn('Shot kit pack missing or has no index.tsx', { kitDir });
    return null;
  }
  const key = `${sourceHash}|${baseUrl}`;
  if (cache?.key === key) return cache.bundle;

  try {
    const result = await esbuild.build({
      entryPoints: [path.join(kitDir, 'index.tsx')],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      jsx: 'automatic',
      external: ['react', 'remotion', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      logLevel: 'silent',
    });
    const code = rewriteKitExternals(result.outputFiles[0].text, baseUrl);
    const bundle: KitBundle = { code, hash: sourceHash, version: await readKitPackVersion(kitDir) };
    cache = { key, bundle };
    log.info('Shot kit bundled', { version: bundle.version, hash: sourceHash, bytes: code.length });
    return bundle;
  } catch (err) {
    log.error('Shot kit bundle failed', err, { kitDir });
    return null;
  }
}
