// Refuse a model that cannot run the builder BEFORE the run (TSX_BUILDER_DESIGN.md
// Rev 2, P1 part 6). The builder needs tool use (its six tools) and image
// input (it looks at its stills). Claude has both; through OpenRouter a user
// can pick any of 450+ models, and the app's catalog (provider-models.ts) is
// a static id/name/tier list with no capabilities — so the list comes from
// OpenRouter's public `GET /v1/models`: `supported_parameters` carries
// `tools`, `architecture.input_modalities` carries `image` (verified
// 2026-10-12). Fetched once per app run per base URL; when it cannot be
// fetched the run goes ahead unchecked (a network that is really down fails
// the run on its own, with its own message).

import { logEngine } from '../../../logging/log-engine';
import { resolveProviderInfo } from '../agents/tool-support';

const log = logEngine.createLogger('TsxBuilderModelCheck');

export const OPENROUTER_HOST = 'openrouter.ai';
export const MODEL_LIST_TIMEOUT_MS = 10_000;
/** The list changes rarely; a refetch per app run is plenty. */
export const MODEL_LIST_TTL_MS = 60 * 60 * 1000;

export interface ModelCapabilities {
  tools: boolean;
  imageInput: boolean;
}

export type ModelCheck = { ok: true; unchecked?: string } | { ok: false; error: string };

/** True for the OpenRouter preset's base URL and any saved config pointing at the same host. */
export function isOpenRouterBaseUrl(baseURL?: string): boolean {
  if (!baseURL) return false;
  try {
    return new URL(baseURL).hostname === OPENROUTER_HOST;
  } catch {
    return false;
  }
}

/** `https://openrouter.ai/api` (the preset) or `.../api/v1` → `https://openrouter.ai/api/v1/models`. */
export function modelListUrl(baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '').replace(/\/v1$/, '');
  return `${base}/v1/models`;
}

/** The capability pair per model id from the list's JSON; an unreadable body gives an empty map. */
export function parseOpenRouterModels(json: unknown): Map<string, ModelCapabilities> {
  const out = new Map<string, ModelCapabilities>();
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return out;
  for (const entry of data) {
    const row = entry as {
      id?: unknown;
      supported_parameters?: unknown;
      architecture?: { input_modalities?: unknown };
    };
    if (typeof row.id !== 'string' || !row.id) continue;
    const params = Array.isArray(row.supported_parameters) ? row.supported_parameters : [];
    const inputs = Array.isArray(row.architecture?.input_modalities) ? row.architecture.input_modalities : [];
    out.set(row.id, { tools: params.includes('tools'), imageInput: inputs.includes('image') });
  }
  return out;
}

/** The refusal for a model, or null when it can run the builder. */
export function judgeBuilderModel(model: string, caps: ModelCapabilities | undefined): string | null {
  if (!caps) return `OpenRouter does not list the model "${model}". Pick a listed model with tool use and image input.`;
  const missing = [...(caps.tools ? [] : ['tool use']), ...(caps.imageInput ? [] : ['image input'])];
  if (missing.length === 0) return null;
  return `The model "${model}" has no ${missing.join(' or ')} on OpenRouter, and the builder needs both (it runs tools and looks at its frames). Pick another model.`;
}

interface CachedList {
  at: number;
  models: Map<string, ModelCapabilities>;
}

const cache = new Map<string, CachedList>();

/** Tests only. */
export function resetOpenRouterModelCache(): void {
  cache.clear();
}

/**
 * The model list for a base URL, cached per app run. Null when it cannot be
 * fetched or read; the reason is logged, never thrown.
 */
export async function fetchOpenRouterModels(
  baseURL: string,
  options: { signal?: AbortSignal; now?: number } = {},
): Promise<Map<string, ModelCapabilities> | null> {
  const now = options.now ?? Date.now();
  const url = modelListUrl(baseURL);
  const hit = cache.get(url);
  if (hit && now - hit.at < MODEL_LIST_TTL_MS) return hit.models;
  try {
    const signals = [AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS), ...(options.signal ? [options.signal] : [])];
    const response = await fetch(url, { signal: AbortSignal.any(signals) });
    if (!response.ok) {
      log.warn('OpenRouter model list not available', { url, status: response.status });
      return null;
    }
    const models = parseOpenRouterModels(await response.json());
    if (models.size === 0) {
      log.warn('OpenRouter model list was empty or unreadable', { url });
      return null;
    }
    cache.set(url, { at: now, models });
    return models;
  } catch (err) {
    log.warn('OpenRouter model list could not be fetched', { url, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * The gate the dispatcher runs before a builder run. Only an OpenRouter
 * provider is checked (every Claude model has tools and vision; the hidden
 * Anthropic-compatible presets publish no list). `model` absent = the
 * provider's default model.
 */
export async function checkBuilderModel(
  providerId?: string,
  model?: string,
  options: { signal?: AbortSignal } = {},
): Promise<ModelCheck> {
  let info: Awaited<ReturnType<typeof resolveProviderInfo>>;
  try {
    info = await resolveProviderInfo(providerId);
  } catch (err) {
    return { ok: true, unchecked: `providers unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!info || !isOpenRouterBaseUrl(info.baseURL)) return { ok: true };
  const chosen = model ?? info.defaultModel;
  if (!chosen) return { ok: true, unchecked: 'no model named' };
  const models = await fetchOpenRouterModels(info.baseURL!, options);
  if (!models) return { ok: true, unchecked: 'model list unavailable' };
  const error = judgeBuilderModel(chosen, models.get(chosen));
  return error ? { ok: false, error } : { ok: true };
}
