import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The pre-run model gate: OpenRouter's public list read for `tools` and image
// input, cached per app run; every other provider passes untouched; a list
// that cannot be fetched lets the run go ahead.

const resolveProviderInfo = vi.fn();
vi.mock('../agents/tool-support', () => ({ resolveProviderInfo: (...a: unknown[]) => resolveProviderInfo(...a) }));

import {
  checkBuilderModel,
  fetchOpenRouterModels,
  isOpenRouterBaseUrl,
  judgeBuilderModel,
  MODEL_LIST_TTL_MS,
  modelListUrl,
  parseOpenRouterModels,
  resetOpenRouterModelCache,
} from './openrouter-model-check';

const LIST = {
  data: [
    { id: 'openai/gpt-6.1-sol', architecture: { input_modalities: ['file', 'image', 'text'] }, supported_parameters: ['tools', 'temperature'] },
    { id: 'z-ai/glm-5.3', architecture: { input_modalities: ['text'] }, supported_parameters: ['tools'] },
    { id: 'some/vision-chat', architecture: { input_modalities: ['text', 'image'] }, supported_parameters: ['temperature'] },
    { id: 'some/text-chat', architecture: { input_modalities: ['text'] }, supported_parameters: [] },
    { id: '', supported_parameters: ['tools'] },
    { name: 'no id' },
    'junk',
  ],
};

const OPENROUTER = { id: 'openrouter', type: 'agent-sdk', baseURL: 'https://openrouter.ai/api', defaultModel: 'anthropic/claude-sonnet-4-6' };

const fetchMock = vi.fn();

function respond(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  resetOpenRouterModelCache();
  resolveProviderInfo.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(respond(LIST));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isOpenRouterBaseUrl / modelListUrl', () => {
  it('recognises the preset host and nothing else', () => {
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api')).toBe(true);
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api/v1/')).toBe(true);
    expect(isOpenRouterBaseUrl('https://api.moonshot.ai/anthropic')).toBe(false);
    expect(isOpenRouterBaseUrl(undefined)).toBe(false);
    expect(isOpenRouterBaseUrl('not a url')).toBe(false);
  });

  it('builds the list URL from the preset base, a /v1 base, or a trailing slash', () => {
    expect(modelListUrl('https://openrouter.ai/api')).toBe('https://openrouter.ai/api/v1/models');
    expect(modelListUrl('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1/models');
    expect(modelListUrl('https://openrouter.ai/api/')).toBe('https://openrouter.ai/api/v1/models');
  });
});

describe('parseOpenRouterModels', () => {
  it('reads tools and image input per id and skips rows without an id', () => {
    const models = parseOpenRouterModels(LIST);
    expect([...models.keys()]).toEqual(['openai/gpt-6.1-sol', 'z-ai/glm-5.3', 'some/vision-chat', 'some/text-chat']);
    expect(models.get('openai/gpt-6.1-sol')).toEqual({ tools: true, imageInput: true });
    expect(models.get('z-ai/glm-5.3')).toEqual({ tools: true, imageInput: false });
    expect(models.get('some/vision-chat')).toEqual({ tools: false, imageInput: true });
    expect(models.get('some/text-chat')).toEqual({ tools: false, imageInput: false });
  });

  it('gives an empty map for a body that is not a list', () => {
    expect(parseOpenRouterModels(null).size).toBe(0);
    expect(parseOpenRouterModels({ data: 'nope' }).size).toBe(0);
    expect(parseOpenRouterModels({ models: [] }).size).toBe(0);
  });
});

describe('judgeBuilderModel', () => {
  it('passes a model with both, and names what is missing otherwise', () => {
    expect(judgeBuilderModel('a', { tools: true, imageInput: true })).toBeNull();
    expect(judgeBuilderModel('z-ai/glm-5.3', { tools: true, imageInput: false })).toBe(
      'The model "z-ai/glm-5.3" has no image input on OpenRouter, and the builder needs both (it runs tools and looks at its frames). Pick another model.',
    );
    expect(judgeBuilderModel('v', { tools: false, imageInput: true })).toContain('has no tool use on OpenRouter');
    expect(judgeBuilderModel('t', { tools: false, imageInput: false })).toContain('has no tool use or image input on OpenRouter');
    expect(judgeBuilderModel('typo/model', undefined)).toBe(
      'OpenRouter does not list the model "typo/model". Pick a listed model with tool use and image input.',
    );
  });
});

describe('fetchOpenRouterModels', () => {
  it('fetches the list once per base URL and serves the cache until the TTL passes', async () => {
    const first = await fetchOpenRouterModels('https://openrouter.ai/api', { now: 1000 });
    expect(first?.size).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/models');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    expect(await fetchOpenRouterModels('https://openrouter.ai/api', { now: 1000 + MODEL_LIST_TTL_MS - 1 })).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchOpenRouterModels('https://openrouter.ai/api', { now: 1000 + MODEL_LIST_TTL_MS });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is null, uncached, when the request fails, is refused, or carries no models', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchOpenRouterModels('https://openrouter.ai/api')).toBeNull();
    fetchMock.mockResolvedValueOnce(respond({ error: 'nope' }, false, 503));
    expect(await fetchOpenRouterModels('https://openrouter.ai/api')).toBeNull();
    fetchMock.mockResolvedValueOnce(respond({ data: [] }));
    expect(await fetchOpenRouterModels('https://openrouter.ai/api')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Nothing was cached by the failures: the next call fetches again.
    expect((await fetchOpenRouterModels('https://openrouter.ai/api'))?.size).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('checkBuilderModel', () => {
  it('passes any provider that is not OpenRouter without fetching', async () => {
    resolveProviderInfo.mockResolvedValueOnce({ id: 'claude-api', type: 'agent-sdk', defaultModel: 'claude-sonnet-5-5' });
    expect(await checkBuilderModel('claude-api', 'claude-opus-5-5')).toEqual({ ok: true });
    resolveProviderInfo.mockResolvedValueOnce(null);
    expect(await checkBuilderModel()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('judges the named model on OpenRouter, or the provider default when none is named', async () => {
    resolveProviderInfo.mockResolvedValue(OPENROUTER);
    expect(await checkBuilderModel('openrouter', 'openai/gpt-6.1-sol')).toEqual({ ok: true });
    expect(await checkBuilderModel('openrouter', 'z-ai/glm-5.3')).toEqual({ ok: false, error: expect.stringContaining('no image input') });
    expect(await checkBuilderModel('openrouter', 'some/vision-chat')).toEqual({ ok: false, error: expect.stringContaining('no tool use') });
    // The preset default is not in this fixture list: an honest "not listed".
    expect(await checkBuilderModel('openrouter')).toEqual({ ok: false, error: expect.stringContaining('does not list the model "anthropic/claude-sonnet-4-6"') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recognises a saved config that points at OpenRouter under another id', async () => {
    resolveProviderInfo.mockResolvedValueOnce({ id: 'my-router', type: 'agent-sdk', baseURL: 'https://openrouter.ai/api', defaultModel: 'some/text-chat' });
    expect(await checkBuilderModel('my-router')).toEqual({ ok: false, error: expect.stringContaining('"some/text-chat"') });
  });

  it('lets the run go ahead, saying why, when the list or the settings are unavailable', async () => {
    resolveProviderInfo.mockResolvedValueOnce(OPENROUTER);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await checkBuilderModel('openrouter', 'z-ai/glm-5.3')).toEqual({ ok: true, unchecked: 'model list unavailable' });

    resolveProviderInfo.mockRejectedValueOnce(new Error('db locked'));
    expect(await checkBuilderModel('openrouter', 'z-ai/glm-5.3')).toEqual({ ok: true, unchecked: 'providers unreadable: db locked' });

    resolveProviderInfo.mockResolvedValueOnce({ id: 'openrouter', type: 'agent-sdk', baseURL: 'https://openrouter.ai/api' });
    expect(await checkBuilderModel('openrouter')).toEqual({ ok: true, unchecked: 'no model named' });
  });

  it('passes the caller signal into the fetch', async () => {
    resolveProviderInfo.mockResolvedValueOnce(OPENROUTER);
    const abort = new AbortController();
    await checkBuilderModel('openrouter', 'openai/gpt-6.1-sol', { signal: abort.signal });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    abort.abort();
    expect(signal.aborted).toBe(true);
  });
});
