import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { getAiRuntimeDevOverrides } from '../services/ai-runtime/dev-overrides';
import { slugifyName } from '../services/agents/tools/workspace-files';

export function getAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getAppPath());
  }
  return app.getAppPath();
}

/** The built main-process bundle (out/main — inside app.asar when packaged).
 *  Hashed by the transpiler fingerprint: any main build change shows up here. */
export function getMainBundleDir(): string {
  return path.join(app.getAppPath(), 'out', 'main');
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

export function getBuiltinPacksDir(): string {
  // Built-in packs in the pack container (TRANSITION_PACKS_DESIGN.md):
  // resources/packs/<packId>/. Installed packs are getInstalledPacksDir()
  // (library-paths.ts) — they follow the assets root.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'packs');
  }
  return path.join(app.getAppPath(), 'resources', 'packs');
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

/** Built-in editing presets (V1 completion plan §2.5): resources/presets/<id>/,
 *  copied into the assets root on first use (preset-builtins.ts). Dev: the
 *  repo folder. Packaged: resources/presets via extraResources. */
export function getBuiltinPresetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'presets');
  }
  return path.join(app.getAppPath(), 'resources', 'presets');
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
  // Dev-only stand-in so automated runs can exercise the MAX_PATH guard (see dev-overrides.ts).
  const override = getAiRuntimeDevOverrides()?.root;
  return override ?? path.join(app.getPath('userData'), 'ai-runtime');
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

// ─── Agents (docs/agents-plan.md §1.5, §1.11) ───────────────────────────────

/** `{userData}/agents/<namespace>/<name>` — user-installed agents, folder-as-truth. */
export function getAgentsDir(): string {
  return path.join(app.getPath('userData'), 'agents');
}

/** Built-in agents shipped with the app; read-only, and shadowed by a newer
 *  user copy of the same id (§1.6). Dev: the repo folder. Packaged:
 *  resources/agents via extraResources. */
export function getBuiltinAgentsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'agents');
  }
  return path.join(app.getAppPath(), 'resources', 'agents');
}

/** `{userData}/agent-sessions/<namespace>.<name>/<sessionId>` (§1.5). */
export function getAgentSessionsDir(): string {
  return path.join(app.getPath('userData'), 'agent-sessions');
}

/**
 * Where a session's generated media files in the Asset Library (§1.11) —
 * `agents/<agent-name>/<session-title>`, RELATIVE to the library root, which
 * is what `generateImageAsset` / `fileVideoAsset` take. Renaming a session
 * never moves files, so this is called once per session and stored.
 */
export function getAgentOutputFolder(agentName: string, sessionTitle: string): string {
  return `agents/${slugifyName(agentName, 'agent')}/${slugifyName(sessionTitle, 'session')}`;
}

// ─── Flows (docs/flows-plan.md §1.7, W8 Stage 6) ───────────────────────────

/** `{userData}/flows/<namespace>/<name>` — user-installed `.vidtsxflow` packages, folder-as-truth. */
export function getFlowsDir(): string {
  return path.join(app.getPath('userData'), 'flows');
}

/** Built-in flows shipped with the app (`resources/flows`), read-only and
 *  shadowed by a newer user copy of the same id, as agents are. */
export function getBuiltinFlowsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'flows');
  }
  return path.join(app.getAppPath(), 'resources', 'flows');
}

/** `{userData}/flows-runs/<flowId>/<runId>` — run folders, OUT of the asset
 *  library so the Assets screen shows only a flow's media (Stage 6 decision;
 *  Stage 1 kept them under `<assets>/flows/<flowId>/runs`). */
export function getFlowRunsDir(): string {
  return path.join(app.getPath('userData'), 'flows-runs');
}

// ─── Templates (docs/templates-plan.md §3) ─────────────────────────────────

/** `{userData}/templates/<namespace>/<name>` — user-installed templates, folder-as-truth. */
export function getTemplatesDir(): string {
  return path.join(app.getPath('userData'), 'templates');
}

/** Built-in templates shipped with the app (`resources/templates`), read-only
 *  and shadowed by a newer user copy of the same id, as agents and flows are. */
export function getBuiltinTemplatesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates');
  }
  return path.join(app.getAppPath(), 'resources', 'templates');
}

/** `{userData}/template-work/<namespace>/<name>` — the writable working copy a
 *  template previews and renders from, with the user's autosaved values beside
 *  it. A built-in cannot render in place: the render writes its wrapper next
 *  to the entry, and `resources/` is read-only in an installed app. */
export function getTemplateWorkDir(): string {
  return path.join(app.getPath('userData'), 'template-work');
}
