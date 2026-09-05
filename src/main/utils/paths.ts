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

export function getShotKitDir(): string {
  // Built-in shot-kit packs (SHOT_QUALITY_DESIGN.md Q4): resources/shot-kit/<packId>/.
  // Same shipping shape as caption packs / shot exemplars.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'shot-kit');
  }
  return path.join(app.getAppPath(), 'resources', 'shot-kit');
}

export function getContentSafetyDir(): string {
  // The bundled Gate B classifier (CONTENT_SAFETY_DESIGN.md D2d): shipped in
  // the installer as a documented exception to download-on-first-use — a
  // fail-closed safety gate must not have an absent state.
  // Dev: the repo folder. Packaged: resources/content-safety via extraResources.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'content-safety');
  }
  return path.join(app.getAppPath(), 'resources', 'content-safety');
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

// ─── AI runtime (downloadable Python + PyTorch) ───────────────────────────
// docs/ai-runtime-implementation-plan.md §3. The runtime itself is downloaded into
// userData; the worker scripts it runs ship with the app in resources/pipelines.

export function getAiRuntimeRoot(): string {
  return path.join(app.getPath('userData'), 'ai-runtime');
}

/** `{userData}/ai-runtime/<version>-<variant>` — the extracted runtime folder. */
export function getAiRuntimeDir(version: string, variant: string): string {
  return path.join(getAiRuntimeRoot(), `${version}-${variant}`);
}

export function getAiRuntimePython(version: string, variant: string): string {
  return path.join(getAiRuntimeDir(version, variant), 'python', 'python.exe');
}

/**
 * `{userData}/ai-models/python` — weights + companions for runtime-backed models
 * (docs/ai-runtime-implementation-plan.md §4 step 2). Each catalogue file declares
 * its `dest` relative to this root (e.g. `rembg/models/u2net/u2net.onnx`).
 */
export function getPythonModelsRoot(): string {
  return path.join(app.getPath('userData'), 'ai-models', 'python');
}

/** Temp folder for the worker request JSON files (one per run, deleted after). */
export function getPythonRequestsDir(): string {
  return path.join(getTempDir(), 'python-requests');
}

/** `{userData}/threed-studio` — 3D Studio models + db (plan §5 step 3). */
export function getThreedStudioDir(): string {
  return path.join(app.getPath('userData'), 'threed-studio');
}

export function getPipelinesDir(): string {
  // Dev: resources/pipelines in the repo. Packaged: resources/pipelines via extraResources.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'pipelines');
  }
  return path.join(app.getAppPath(), 'resources', 'pipelines');
}
