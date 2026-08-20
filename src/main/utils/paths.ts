import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

export function getAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getAppPath());
  }
  return app.getAppPath();
}

export function getProjectsDir(): string {
  return path.join(app.getPath('userData'), 'projects');
}

export function getAssetsDir(): string {
  return path.join(app.getPath('userData'), 'assets');
}

export function getTempDir(): string {
  return path.join(app.getPath('temp'), 'vidtsx-studio');
}

export function getBinariesDir(): string {
  // In development, binaries are in resources/binaries
  // In production, they're in the app.asar.unpacked/resources/binaries
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'binaries');
  }
  return path.join(app.getAppPath(), 'resources', 'binaries');
}

export function getVendorDir(): string {
  // Pre-bundled ESM modules for user TSX (three, @react-three/*, @remotion/three).
  // Dev: resources/vendor in the repo. Packaged: resources/vendor via extraResources.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'vendor');
  }
  return path.join(app.getAppPath(), 'resources', 'vendor');
}

export function getCaptionTemplatesDir(): string {
  // Built-in caption packs (PACKS_DESIGN.md): resources/caption-templates/<packId>/.
  // Dev: the repo folder. Packaged: resources/caption-templates via extraResources.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'caption-templates');
  }
  return path.join(app.getAppPath(), 'resources', 'caption-templates');
}

export function getShotExemplarsDir(): string {
  // Built-in shot exemplar packs (SHOT_QUALITY_DESIGN.md Q3a):
  // resources/shot-exemplars/<packId>/. Same shipping shape as caption packs.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'shot-exemplars');
  }
  return path.join(app.getAppPath(), 'resources', 'shot-exemplars');
}

export function getSkillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills');
  }
  return path.join(app.getAppPath(), 'resources', 'skills');
}

// Override for RenderInternals.getExecutablePath({ binariesDirectory }). Default
// resolution returns __dirname of @remotion/compositor-win32-x64-msvc, which lives
// inside app.asar in packaged builds — and Windows can't spawn .exe from inside asar.
// The .exe is unpacked via electron-builder's auto-unpack heuristic; we point Remotion
// at the unpacked location explicitly. Returns null in dev so Remotion's default wins.
export function getRemotionBinariesDir(): string | null {
  if (!app.isPackaged) return null;
  return path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@remotion',
    'compositor-win32-x64-msvc',
  );
}

export function getFontCacheDir(): string {
  return path.join(app.getPath('userData'), 'font-cache');
}

export async function ensureFontCacheDir(): Promise<void> {
  await fs.mkdir(getFontCacheDir(), { recursive: true });
}

export async function ensureProjectsDir(): Promise<void> {
  const dir = getProjectsDir();
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureAssetsDir(): Promise<void> {
  const dir = getAssetsDir();
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureTempDir(): Promise<void> {
  const dir = getTempDir();
  await fs.mkdir(dir, { recursive: true });
}

export function getPythonDir(): string {
  // In production, electron-builder copies the platform-specific folder to resources/python/
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python');
  }
  // In dev, resolve the platform+arch subdirectory
  const platformDir = process.platform === 'win32'
    ? 'win-x64'
    : `darwin-${process.arch}`;
  return path.join(app.getAppPath(), 'resources', 'python', platformDir);
}

export function getPythonExePath(): string {
  const exe = process.platform === 'win32' ? 'python.exe' : 'bin/python3';
  return path.join(getPythonDir(), exe);
}

export function getPythonPackagesDir(): string {
  return path.join(app.getPath('userData'), 'python-packages');
}
