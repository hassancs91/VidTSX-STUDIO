import { app } from 'electron';
import path from 'path';
import type { ProviderConfig } from '../../engine/types';
import type { ImageProviderConfig } from '../../image-engine';
import type { ContentPresetSetting, RenderGpuBackend, RenderHardwareAcceleration, StylePresetSetting, UpdateChannel } from '../../shared/ipc/types';
import type { ProviderCredentials, ProviderKeyId } from '../../shared/ipc/types/provider-keys';
import type { SttProviderConfig } from '../../shared/ipc/types/stt';
import type { ModelUsageMap } from '../../shared/model-library/types';
import { normalizeExportEngineId, type ExportEngineId } from '../../shared/studio/export-engines';
import { getAllValues, getValue, setValue, setValues } from './settings-db';

export type RenderCpuUsage = 'low' | 'medium' | 'high' | 'max';
const RENDER_CPU_USAGE_VALUES: readonly RenderCpuUsage[] = ['low', 'medium', 'high', 'max'] as const;

const RENDER_GPU_BACKEND_VALUES: readonly RenderGpuBackend[] = [
  'swangle',
  'swiftshader',
  'angle',
  'angle-egl',
  'egl',
  'vulkan',
] as const;

const RENDER_HARDWARE_ACCELERATION_VALUES: readonly RenderHardwareAcceleration[] = [
  'disable',
  'if-possible',
  'required',
] as const;

export interface AppSettings {
  outputFolder: string;
  aiModelsFolder: string;
  whisperModel: string;
  renderTimeoutSeconds: number;
  renderDefaultCpuUsage: RenderCpuUsage;
  renderDefaultGpuBackend: RenderGpuBackend;
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  renderDefaultExportEngine: ExportEngineId;
  llmProviders?: ProviderConfig[];
  llmActiveProvider?: string;
  imageProviders?: ImageProviderConfig[];
  imageActiveProvider?: string;
  contentPresets?: ContentPresetSetting[];
  stylePresets?: StylePresetSetting[];
  audioActiveSttModel?: string;
  audioActiveTtsModel?: string;
  sdImageActiveModel?: string;
  /** Where scanned image models live. Defaults to `{aiModelsFolder}/image`. */
  imageModelsFolder?: string;
  localLlmActiveModel?: string;
}

// Hardcoded defaults — mirrors src/features/image-studio/services/style-presets.ts
const DEFAULT_CONTENT_PRESETS: ContentPresetSetting[] = [
  { id: 'youtube-thumb', label: 'YT Thumbnail', aspectRatio: '16:9', promptSuffix: 'cinematic composition, bold text area, vibrant colors, high contrast' },
  { id: 'portrait', label: 'Portrait', aspectRatio: '3:2', promptSuffix: 'subject centered, soft lighting, shallow depth of field, natural tones' },
  { id: 'instagram-post', label: 'IG Post', aspectRatio: '1:1', promptSuffix: 'centered composition, aesthetic framing, balanced negative space' },
  { id: 'instagram-story', label: 'IG Story', aspectRatio: '9:16', promptSuffix: 'vertical layout, text-safe zone at bottom, full-bleed visuals' },
  { id: 'product-shot', label: 'Product', aspectRatio: '1:1', promptSuffix: 'clean white background, studio lighting, sharp details, commercial quality' },
  { id: 'landscape', label: 'Landscape', aspectRatio: '16:9', promptSuffix: 'panoramic, epic scale, detailed environment, immersive atmosphere' },
  { id: 'avatar', label: 'Avatar', aspectRatio: '1:1', promptSuffix: 'face focused, clean background, symmetrical, professional' },
  { id: 'logo', label: 'Logo', aspectRatio: '1:1', promptSuffix: 'centered logo, minimal, transparent background feel, vector-style' },
  { id: 'comic', label: 'Comic', aspectRatio: '4:3', promptSuffix: 'bold outlines, narrative scene, dramatic angle, dynamic composition' },
  { id: 'book-cover', label: 'Book Cover', aspectRatio: '3:2', promptSuffix: 'title space at top, dramatic composition, genre-appropriate mood' },
];

const DEFAULT_STYLE_PRESETS: StylePresetSetting[] = [
  { id: 'zombie', label: 'Zombie', promptSuffix: 'zombie style, undead, decaying flesh, horror aesthetic' },
  { id: 'old-person', label: 'Aged', promptSuffix: 'elderly person, wrinkled skin, gray hair, aged appearance' },
  { id: 'cartoon', label: 'Cartoon', promptSuffix: 'cartoon style, animated, bold outlines, vibrant colors' },
  { id: 'anime', label: 'Anime', promptSuffix: 'anime style, Japanese animation, large eyes, detailed' },
  { id: 'watercolor', label: 'Watercolor', promptSuffix: 'watercolor painting, soft edges, paint strokes, artistic' },
  { id: 'pixel-art', label: 'Pixel Art', promptSuffix: 'pixel art style, 8-bit, retro gaming aesthetic' },
  { id: 'oil-painting', label: 'Oil Paint', promptSuffix: 'oil painting on canvas, thick brushstrokes, classical art' },
  { id: 'pencil-sketch', label: 'Sketch', promptSuffix: 'pencil sketch, hand-drawn, graphite on paper' },
  { id: 'cyberpunk', label: 'Cyberpunk', promptSuffix: 'cyberpunk style, neon lights, futuristic city, dystopian' },
  { id: 'fantasy', label: 'Fantasy', promptSuffix: 'fantasy art, magical, ethereal lighting, epic scene' },
  { id: '3d-render', label: '3D', promptSuffix: '3D render, realistic materials, studio lighting, octane render' },
  { id: 'pop-art', label: 'Pop Art', promptSuffix: 'pop art style, bold colors, halftone dots, Andy Warhol inspired' },
  { id: 'vintage-photo', label: 'Vintage', promptSuffix: 'vintage photograph, sepia tone, film grain, retro' },
];

const DEFAULT_WHISPER_MODEL = 'base';

// Per-frame render timeout passed to Remotion's renderMedia/selectComposition.
// Heavy WebGL/Three.js scenes can take many seconds per frame, especially on
// first-frame shader compilation. 600s is generous enough to cover virtually
// any real composition without masking genuine hangs. User-configurable via
// Settings > General.
const DEFAULT_RENDER_TIMEOUT_SECONDS = 600;
const MIN_RENDER_TIMEOUT_SECONDS = 30;
const MAX_RENDER_TIMEOUT_SECONDS = 3600;

function clampRenderTimeout(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_RENDER_TIMEOUT_SECONDS;
  return Math.min(MAX_RENDER_TIMEOUT_SECONDS, Math.max(MIN_RENDER_TIMEOUT_SECONDS, Math.round(seconds)));
}

const DEFAULT_RENDER_CPU_USAGE: RenderCpuUsage = 'medium';

function normalizeCpuUsage(value: unknown): RenderCpuUsage {
  return typeof value === 'string' && (RENDER_CPU_USAGE_VALUES as readonly string[]).includes(value)
    ? (value as RenderCpuUsage)
    : DEFAULT_RENDER_CPU_USAGE;
}

// Default to software rendering (swangle) so existing installs get zero behavior
// change. Users opt into GPU explicitly via Settings or the per-render modal.
const DEFAULT_RENDER_GPU_BACKEND: RenderGpuBackend = 'swangle';

function normalizeGpuBackend(value: unknown): RenderGpuBackend {
  return typeof value === 'string' && (RENDER_GPU_BACKEND_VALUES as readonly string[]).includes(value)
    ? (value as RenderGpuBackend)
    : DEFAULT_RENDER_GPU_BACKEND;
}

// Default to 'if-possible' — Remotion auto-detects NVENC/QSV/AMF/VideoToolbox
// and silently falls back to CPU when no supported encoder is available.
// Free speed win for modern hardware, zero crash risk otherwise.
const DEFAULT_RENDER_HARDWARE_ACCELERATION: RenderHardwareAcceleration = 'if-possible';

function normalizeHardwareAcceleration(value: unknown): RenderHardwareAcceleration {
  return typeof value === 'string' && (RENDER_HARDWARE_ACCELERATION_VALUES as readonly string[]).includes(value)
    ? (value as RenderHardwareAcceleration)
    : DEFAULT_RENDER_HARDWARE_ACCELERATION;
}

function getDefaultAiModelsFolder(): string {
  return path.join(app.getPath('userData'), 'ai-models');
}

function getDefaultOutputFolder(): string {
  return path.join(app.getPath('videos'), 'VidTSX');
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = getAllValues();
  return {
    outputFolder: typeof raw.outputFolder === 'string' && raw.outputFolder ? raw.outputFolder : getDefaultOutputFolder(),
    aiModelsFolder: typeof raw.aiModelsFolder === 'string' && raw.aiModelsFolder ? raw.aiModelsFolder : getDefaultAiModelsFolder(),
    whisperModel: typeof raw.whisperModel === 'string' && raw.whisperModel ? raw.whisperModel : DEFAULT_WHISPER_MODEL,
    renderTimeoutSeconds: typeof raw.renderTimeoutSeconds === 'number' ? clampRenderTimeout(raw.renderTimeoutSeconds) : DEFAULT_RENDER_TIMEOUT_SECONDS,
    renderDefaultCpuUsage: normalizeCpuUsage(raw.renderDefaultCpuUsage),
    renderDefaultGpuBackend: normalizeGpuBackend(raw.renderDefaultGpuBackend),
    renderDefaultHardwareAcceleration: normalizeHardwareAcceleration(raw.renderDefaultHardwareAcceleration),
    renderDefaultExportEngine: normalizeExportEngineId(raw.renderDefaultExportEngine),
    llmProviders: raw.llmProviders as ProviderConfig[] | undefined,
    llmActiveProvider: raw.llmActiveProvider as string | undefined,
    imageProviders: raw.imageProviders as ImageProviderConfig[] | undefined,
    imageActiveProvider: raw.imageActiveProvider as string | undefined,
    contentPresets: raw.contentPresets as ContentPresetSetting[] | undefined,
    stylePresets: raw.stylePresets as StylePresetSetting[] | undefined,
    audioActiveSttModel: raw.audioActiveSttModel as string | undefined,
    audioActiveTtsModel: raw.audioActiveTtsModel as string | undefined,
    sdImageActiveModel: raw.sdImageActiveModel as string | undefined,
    imageModelsFolder: raw.imageModelsFolder as string | undefined,
    localLlmActiveModel: raw.localLlmActiveModel as string | undefined,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  setValues(settings as unknown as Record<string, unknown>);
}

export async function getOutputFolder(): Promise<string> {
  const v = getValue<string>('outputFolder');
  return v && v.length > 0 ? v : getDefaultOutputFolder();
}

export async function setOutputFolder(folderPath: string): Promise<void> {
  setValue('outputFolder', folderPath);
}

export async function getAiModelsFolder(): Promise<string> {
  const v = getValue<string>('aiModelsFolder');
  return v && v.length > 0 ? v : getDefaultAiModelsFolder();
}

export async function setAiModelsFolder(folderPath: string): Promise<void> {
  setValue('aiModelsFolder', folderPath);
}

export async function getWhisperModel(): Promise<string> {
  const v = getValue<string>('whisperModel');
  return v && v.length > 0 ? v : DEFAULT_WHISPER_MODEL;
}

export async function setWhisperModel(modelId: string): Promise<void> {
  setValue('whisperModel', modelId);
}

export async function getRenderTimeoutSeconds(): Promise<number> {
  const v = getValue<number>('renderTimeoutSeconds');
  return typeof v === 'number' ? clampRenderTimeout(v) : DEFAULT_RENDER_TIMEOUT_SECONDS;
}

export async function setRenderTimeoutSeconds(seconds: number): Promise<void> {
  setValue('renderTimeoutSeconds', clampRenderTimeout(seconds));
}

export async function getRenderDefaultCpuUsage(): Promise<RenderCpuUsage> {
  return normalizeCpuUsage(getValue<string>('renderDefaultCpuUsage'));
}

export async function setRenderDefaultCpuUsage(value: RenderCpuUsage): Promise<void> {
  setValue('renderDefaultCpuUsage', normalizeCpuUsage(value));
}

export async function getRenderDefaultGpuBackend(): Promise<RenderGpuBackend> {
  return normalizeGpuBackend(getValue<string>('renderDefaultGpuBackend'));
}

export async function setRenderDefaultGpuBackend(value: RenderGpuBackend): Promise<void> {
  setValue('renderDefaultGpuBackend', normalizeGpuBackend(value));
}

export async function getRenderDefaultHardwareAcceleration(): Promise<RenderHardwareAcceleration> {
  return normalizeHardwareAcceleration(getValue<string>('renderDefaultHardwareAcceleration'));
}

export async function setRenderDefaultHardwareAcceleration(value: RenderHardwareAcceleration): Promise<void> {
  setValue('renderDefaultHardwareAcceleration', normalizeHardwareAcceleration(value));
}

// Studio export engine the Export dialog starts on (docs/export-engines-plan.md
// D2). Ships as the catalogue's first entry; an unknown saved id (an engine
// removed in a later build) falls back to it rather than blocking exports.
export async function getRenderDefaultExportEngine(): Promise<ExportEngineId> {
  return normalizeExportEngineId(getValue<string>('renderDefaultExportEngine'));
}

export async function setRenderDefaultExportEngine(value: ExportEngineId): Promise<void> {
  setValue('renderDefaultExportEngine', normalizeExportEngineId(value));
}

// Opt-in crash reporting (Settings > Privacy). Off unless the user explicitly
// enabled it — absence of the key means no consent.
export async function getCrashReportingEnabled(): Promise<boolean> {
  return getValue<boolean>('crashReportingEnabled') === true;
}

export async function setCrashReportingEnabled(enabled: boolean): Promise<void> {
  setValue('crashReportingEnabled', enabled === true);
}

// ─── Studio proxies: optional GPU encoder (T4b, docs/PREVIEW_TESTS_PLAN.md) ───
// Off unless the user turned it on; it also needs the downloaded full ffmpeg
// and a working hardware encoder before the generator uses it.

export async function getProxyGpuEncoderEnabled(): Promise<boolean> {
  return getValue<boolean>('proxyGpuEncoderEnabled') === true;
}

export async function setProxyGpuEncoderEnabled(enabled: boolean): Promise<void> {
  setValue('proxyGpuEncoderEnabled', enabled === true);
}

// ─── Auto-update preferences (docs/auto-update-plan.md) ───
// Downloading in the background is the default: the whole point is that the bits
// are already local by the time the user is told an update exists.

export async function getUpdateAutoDownload(): Promise<boolean> {
  return getValue<boolean>('updateAutoDownload') !== false;
}

export async function setUpdateAutoDownload(enabled: boolean): Promise<void> {
  setValue('updateAutoDownload', enabled === true);
}

export async function getUpdateChannel(): Promise<UpdateChannel> {
  return getValue<string>('updateChannel') === 'beta' ? 'beta' : 'stable';
}

export async function setUpdateChannel(channel: UpdateChannel): Promise<void> {
  setValue('updateChannel', channel === 'beta' ? 'beta' : 'stable');
}

/** Version the user dismissed via "Later". Suppresses auto-nagging only. */
export async function getUpdateSkippedVersion(): Promise<string | null> {
  return getValue<string>('updateSkippedVersion') || null;
}

export async function setUpdateSkippedVersion(version: string | null): Promise<void> {
  setValue('updateSkippedVersion', version ?? '');
}

// ─── Announcements feed (V1_RELEASE_PLAN Phase I) ───
// Default ON; the card is dismissible per message and the whole feature
// turns off here. Dismissed ids persist so a message never reshows.

export async function getNewsEnabled(): Promise<boolean> {
  return getValue<boolean>('newsEnabled') !== false;
}

export async function setNewsEnabled(enabled: boolean): Promise<void> {
  setValue('newsEnabled', enabled === true);
}

/** The feed itself is capped at 20 messages; this cap only bounds years of
 *  accumulated dismissals (oldest dropped first — long-expired ids anyway). */
const MAX_NEWS_DISMISSED_IDS = 200;

export async function getNewsDismissedIds(): Promise<string[]> {
  const v = getValue<string[]>('newsDismissedIds');
  return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [];
}

export async function addNewsDismissedId(id: string): Promise<void> {
  const current = await getNewsDismissedIds();
  if (current.includes(id)) return;
  setValue('newsDismissedIds', [...current, id].slice(-MAX_NEWS_DISMISSED_IDS));
}

export async function getLlmProviders(): Promise<{ providers: ProviderConfig[]; activeProvider?: string }> {
  return {
    providers: getValue<ProviderConfig[]>('llmProviders') ?? [],
    activeProvider: getValue<string>('llmActiveProvider'),
  };
}

export async function saveLlmProviders(providers: ProviderConfig[], activeProvider: string): Promise<void> {
  setValues({ llmProviders: providers, llmActiveProvider: activeProvider });
}

export async function getImageProviders(): Promise<{ providers: ImageProviderConfig[]; activeProvider?: string }> {
  return {
    providers: getValue<ImageProviderConfig[]>('imageProviders') ?? [],
    activeProvider: getValue<string>('imageActiveProvider'),
  };
}

export async function saveImageProviders(providers: ImageProviderConfig[], activeProvider?: string): Promise<void> {
  setValues({ imageProviders: providers, imageActiveProvider: activeProvider });
}

export async function getSttProviders(): Promise<{ providers: SttProviderConfig[]; activeProvider?: string }> {
  return {
    providers: getValue<SttProviderConfig[]>('sttProviders') ?? [],
    activeProvider: getValue<string>('sttActiveProvider'),
  };
}

export async function saveSttProviders(providers: SttProviderConfig[], activeProvider?: string): Promise<void> {
  setValues({ sttProviders: providers, sttActiveProvider: activeProvider });
}

export async function getTsxJobsMaxConcurrent(): Promise<number> {
  const v = getValue<number>('tsxJobsMaxConcurrent');
  return typeof v === 'number' && v >= 1 && v <= 4 ? v : 4;
}

export async function setTsxJobsMaxConcurrent(value: number): Promise<void> {
  setValue('tsxJobsMaxConcurrent', value);
}

export async function getProviderCredentials(): Promise<ProviderCredentials> {
  return getValue<ProviderCredentials>('providerCredentials') ?? {};
}

/**
 * Merge-saves credentials: non-empty values overwrite, empty/undefined values
 * keep the existing key, ids in `clear` are removed.
 */
export async function saveProviderCredentials(
  keys: Partial<Record<ProviderKeyId, string>>,
  clear?: ProviderKeyId[],
): Promise<ProviderCredentials> {
  const current = await getProviderCredentials();
  const next: ProviderCredentials = { ...current };
  for (const [id, value] of Object.entries(keys) as Array<[ProviderKeyId, string | undefined]>) {
    if (value && value.trim().length > 0) next[id] = value.trim();
  }
  for (const id of clear ?? []) {
    delete next[id];
  }
  setValue('providerCredentials', next);
  return next;
}

/**
 * Cloudflare account id — the non-secret half of the Workers AI credential
 * pair (the API token lives in providerCredentials under safeStorage). Stored
 * as an ordinary plaintext settings value (NEXT_FEATURES_DESIGN §Q2).
 */
export async function getCloudflareAccountId(): Promise<string> {
  const v = getValue<string>('cloudflareAccountId');
  return typeof v === 'string' ? v : '';
}

export async function setCloudflareAccountId(accountId: string): Promise<void> {
  setValue('cloudflareAccountId', accountId.trim());
}

/**
 * User-edited provider model catalogs (AI page → Providers → Model Catalogs).
 * Only providers×categories the user customized are stored; everything else
 * falls back to PROVIDER_MODEL_DEFAULTS. Shape:
 * { [providerId]: { [category]: ImageModelCatalogEntry[] } }
 */
export type ProviderModelOverrides = Record<
  string,
  Partial<
    Record<
      string,
      import('../../shared/presets/provider-model-defaults').ProviderModelCatalogEntry[]
    >
  >
>;

export async function getProviderModelOverrides(): Promise<ProviderModelOverrides> {
  return getValue<ProviderModelOverrides>('providerModels') ?? {};
}

export async function saveProviderModelOverrides(overrides: ProviderModelOverrides): Promise<void> {
  setValue('providerModels', overrides);
}

/**
 * Canonical OpenRouter key resolution: shared credential first, then legacy
 * per-engine provider configs (LLM, then image) as silent fallback.
 */
export async function getOpenRouterApiKey(): Promise<string | null> {
  const credentials = await getProviderCredentials();
  if (credentials.openrouter) return credentials.openrouter;
  const llm = getValue<ProviderConfig[]>('llmProviders') ?? [];
  const llmKey = llm.find((p) => p.id === 'openrouter' && p.apiKey)?.apiKey;
  if (llmKey) return llmKey;
  const image = getValue<ImageProviderConfig[]>('imageProviders') ?? [];
  const imageKey = image.find((p) => p.type === 'openrouter' && p.apiKey)?.apiKey;
  return imageKey ?? null;
}

export async function getPromptPresets(): Promise<{ contentPresets: ContentPresetSetting[]; stylePresets: StylePresetSetting[] }> {
  return {
    contentPresets: getValue<ContentPresetSetting[]>('contentPresets') ?? DEFAULT_CONTENT_PRESETS,
    stylePresets: getValue<StylePresetSetting[]>('stylePresets') ?? DEFAULT_STYLE_PRESETS,
  };
}

export async function savePromptPresets(contentPresets: ContentPresetSetting[], stylePresets: StylePresetSetting[]): Promise<void> {
  setValues({ contentPresets, stylePresets });
}

export async function resetPromptPresets(): Promise<{ contentPresets: ContentPresetSetting[]; stylePresets: StylePresetSetting[] }> {
  setValues({ contentPresets: DEFAULT_CONTENT_PRESETS, stylePresets: DEFAULT_STYLE_PRESETS });
  return { contentPresets: DEFAULT_CONTENT_PRESETS, stylePresets: DEFAULT_STYLE_PRESETS };
}

export async function getAudioSettings(): Promise<{ activeSttModelId: string | null; activeTtsModelId: string | null }> {
  return {
    activeSttModelId: getValue<string>('audioActiveSttModel') ?? null,
    activeTtsModelId: getValue<string>('audioActiveTtsModel') ?? null,
  };
}

export async function saveAudioSettings(activeSttModelId?: string, activeTtsModelId?: string): Promise<void> {
  const update: Record<string, unknown> = {};
  if (activeSttModelId !== undefined) update.audioActiveSttModel = activeSttModelId;
  if (activeTtsModelId !== undefined) update.audioActiveTtsModel = activeTtsModelId;
  if (Object.keys(update).length > 0) setValues(update);
}

export async function getSdImageSettings(): Promise<{ activeModelId: string | null }> {
  return {
    activeModelId: getValue<string>('sdImageActiveModel') ?? null,
  };
}

export async function saveSdImageSettings(activeModelId?: string): Promise<void> {
  if (activeModelId !== undefined) setValue('sdImageActiveModel', activeModelId);
}

/** Models folder for scanned image models. Defaults to `{aiModelsFolder}/image`. */
export async function getImageModelsFolder(): Promise<string> {
  const v = getValue<string>('imageModelsFolder');
  if (v && v.length > 0) return v;
  return path.join(await getAiModelsFolder(), 'image');
}

export async function setImageModelsFolder(folderPath: string): Promise<void> {
  setValue('imageModelsFolder', folderPath);
}

// Local-only model usage tracking (design §6.1). Sync accessors so the
// model-library usage store can read/write directly.
export function getModelUsageMap(): ModelUsageMap {
  return getValue<ModelUsageMap>('modelUsage') ?? {};
}

export function setModelUsageMap(map: ModelUsageMap): void {
  setValue('modelUsage', map);
}

function getDefaultStudioProjectsRoot(): string {
  return path.join(app.getPath('videos'), 'VidTSX Studio');
}

/** Root folder for Studio (AI video editor) projects — user-configurable
 *  because proxies/renders are large and belong on a drive the user picks. */
export async function getStudioProjectsRoot(): Promise<string> {
  const v = getValue<string>('studioProjectsRoot');
  return v && v.length > 0 ? v : getDefaultStudioProjectsRoot();
}

export async function setStudioProjectsRoot(folderPath: string): Promise<void> {
  setValue('studioProjectsRoot', folderPath);
}

export async function getLocalLlmSettings(): Promise<{ activeModelId: string | null }> {
  return {
    activeModelId: getValue<string>('localLlmActiveModel') ?? null,
  };
}

export async function saveLocalLlmSettings(activeModelId?: string): Promise<void> {
  if (activeModelId !== undefined) setValue('localLlmActiveModel', activeModelId);
}

export const settingsService = {
  loadSettings,
  saveSettings,
  getOutputFolder,
  setOutputFolder,
  getWhisperModel,
  setWhisperModel,
  getRenderTimeoutSeconds,
  setRenderTimeoutSeconds,
  getRenderDefaultCpuUsage,
  setRenderDefaultCpuUsage,
  getRenderDefaultGpuBackend,
  setRenderDefaultGpuBackend,
  getRenderDefaultHardwareAcceleration,
  setRenderDefaultHardwareAcceleration,
  getRenderDefaultExportEngine,
  setRenderDefaultExportEngine,
  getCrashReportingEnabled,
  setCrashReportingEnabled,
  getNewsEnabled,
  setNewsEnabled,
  getNewsDismissedIds,
  addNewsDismissedId,
  getLlmProviders,
  saveLlmProviders,
  getTsxJobsMaxConcurrent,
  setTsxJobsMaxConcurrent,
  getImageProviders,
  saveImageProviders,
  getProviderCredentials,
  saveProviderCredentials,
  getCloudflareAccountId,
  setCloudflareAccountId,
  getOpenRouterApiKey,
  getSttProviders,
  saveSttProviders,
  getPromptPresets,
  savePromptPresets,
  resetPromptPresets,
  getAudioSettings,
  saveAudioSettings,
  getSdImageSettings,
  saveSdImageSettings,
  getImageModelsFolder,
  setImageModelsFolder,
  getLocalLlmSettings,
  saveLocalLlmSettings,
  getStudioProjectsRoot,
  setStudioProjectsRoot,
};
