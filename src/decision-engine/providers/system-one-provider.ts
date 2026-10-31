/**
 * System One over HTTPS — Jev (TypeSafe) and OpenRouter's Decisions API (DECISION_MODELS_DESIGN.md §5.1, §9; ruling D-r16).
 *
 * A TRANSPORT: the caller's `state` + keyed `questions` go out unchanged as `{ model, state, questions }`; the only rewrite is OpenRouter's
 * required `noul` criteria (`{ true: 'yes', false: 'no' }` when the caller sent none). `fetch` is injected (main passes the global one;
 * tests a stub). One retry on 429 / 5xx / a network error inside the caller's budget, never on another 4xx. A request is split only when it
 * is over a per-request limit (400 questions, 64k estimated tokens), one `calls` entry per HTTP call. Every error message is scrubbed of
 * the key, the state and the instructions.
 */
import { decisionSecrets, scrubDecisionText } from '../scrub';
import {
  DecisionError,
  type DecisionAnswer,
  type DecisionCallUsage,
  type DecisionLimits,
  type DecisionProvider,
  type DecisionProviderId,
  type DecisionProviderOutput,
  type DecisionProviderReadiness,
  type DecisionQuestion,
  type DecisionRequest,
} from '../types';
import { estimateTokens } from '../validate';
import { readSystemOneAnswers } from './system-one-answers';

/** The slice of `Response` the adapter reads. */
export interface SystemOneFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** The slice of `fetch` the adapter calls (structurally the global one). */
export type SystemOneFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<SystemOneFetchResponse>;

/** D2 §5.1 (Jev; the same packing for OpenRouter). `maxQuestions` is the post-split ceiling (validate.ts's). */
export const SYSTEM_ONE_LIMITS: DecisionLimits = { maxOptions: 255, maxLevels: 10, maxStateTokens: 64_000, maxQuestions: 1_000 };
const PER_REQUEST_QUESTIONS = 400;
const PER_REQUEST_TOKENS = 64_000;
const PER_QUESTION_TOKENS = 32_000;
/** §9: Jev and MSD1 list $0.042 / M input; output is free. */
const DEFAULT_USD_PER_M_INPUT = 0.042;
const OPENROUTER_NOUL_CRITERIA = { true: 'yes', false: 'no' } as const;

export interface SystemOneProviderOptions {
  id: DecisionProviderId;
  baseURL: string;
  model: string;
  apiKey: string;
  fetch?: SystemOneFetch;
  /** OpenRouter requires `criteria` on `noul` (default: true when the host is openrouter.ai). */
  noulCriteriaRequired?: boolean;
  usdPerMInputTokens?: number;
  /** The pause before the one retry (default 250–750 ms jitter). */
  retryDelayMs?: () => number;
  /** Milliseconds clock for `calls[].durationMs`. */
  now?: () => number;
}

const defaultFetch: SystemOneFetch = (url, init) => globalThis.fetch(url, init);

function hostIsOpenRouter(baseURL: string): boolean {
  try {
    return new URL(baseURL).hostname.endsWith('openrouter.ai');
  } catch {
    return false;
  }
}

function abortError(id: DecisionProviderId): DecisionError {
  return new DecisionError('cancelled', `${id}: the request was aborted`, id);
}

function pause(ms: number, signal: AbortSignal, id: DecisionProviderId): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError(id));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(id));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** The provider's own error text from a JSON error body (never a non-JSON body). */
function errorText(body: string): string {
  try {
    const json: unknown = JSON.parse(body);
    if (typeof json !== 'object' || json === null) return '';
    const { error, message } = json as { error?: unknown; message?: unknown };
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
    return typeof message === 'string' ? message : '';
  } catch {
    return '';
  }
}

export class SystemOneProvider implements DecisionProvider {
  readonly id: DecisionProviderId;
  readonly model: string;
  private readonly options: SystemOneProviderOptions;
  private readonly fetchImpl: SystemOneFetch;
  private readonly noulCriteriaRequired: boolean;

  constructor(options: SystemOneProviderOptions) {
    this.id = options.id;
    this.model = options.model;
    this.options = options;
    this.fetchImpl = options.fetch ?? defaultFetch;
    this.noulCriteriaRequired = options.noulCriteriaRequired ?? hostIsOpenRouter(options.baseURL);
  }

  limits(): DecisionLimits {
    return { ...SYSTEM_ONE_LIMITS };
  }

  async checkReady(): Promise<DecisionProviderReadiness> {
    return this.options.apiKey ? { ready: true } : { ready: false, reason: 'no key' };
  }

  async decide(request: DecisionRequest, signal: AbortSignal): Promise<DecisionProviderOutput> {
    const secrets = decisionSecrets(request, this.options.apiKey);
    try {
      if (signal.aborted) throw abortError(this.id);
      const answers: Record<string, DecisionAnswer> = {};
      const calls: DecisionCallUsage[] = [];
      for (const chunk of this.pack(request)) {
        const { json, call } = await this.send(request.state, chunk, signal);
        Object.assign(answers, readSystemOneAnswers(json, chunk, this.id));
        calls.push(call);
      }
      const usage = {
        inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
        costUsd: calls.reduce((s, c) => s + c.costUsd, 0),
      };
      return { answers, model: calls[0]?.model ?? this.model, usage, calls };
    } catch (err) {
      if (err instanceof DecisionError) throw new DecisionError(err.code, scrubDecisionText(err.message, secrets), this.id);
      throw new DecisionError('provider-error', scrubDecisionText(`${this.id}: ${err instanceof Error ? err.message : String(err)}`, secrets), this.id);
    }
  }

  /** The questions as the caller sent them, in request-sized chunks (one chunk unless a per-request limit is passed). */
  private pack(request: DecisionRequest): Array<Record<string, DecisionQuestion>> {
    const stateTokens = estimateTokens(typeof request.state === 'string' ? request.state : JSON.stringify(request.state));
    const chunks: Array<Record<string, DecisionQuestion>> = [];
    let current: Record<string, DecisionQuestion> = {};
    let count = 0;
    let tokens = stateTokens;
    for (const [key, question] of Object.entries(request.questions)) {
      const t = estimateTokens(question.instructions) + estimateTokens(JSON.stringify(question.criteria ?? ''));
      if (t > PER_QUESTION_TOKENS || stateTokens + t > PER_REQUEST_TOKENS) {
        throw new DecisionError('unsupported', `${this.id}: question "${key.slice(0, 60)}" is over the per-request token limit`, this.id);
      }
      if (count > 0 && (count + 1 > PER_REQUEST_QUESTIONS || tokens + t > PER_REQUEST_TOKENS)) {
        chunks.push(current);
        [current, count, tokens] = [{}, 0, stateTokens];
      }
      current[key] = this.noulCriteriaRequired && question.type === 'noul' && !question.criteria ? { ...question, criteria: { ...OPENROUTER_NOUL_CRITERIA } } : question;
      count += 1;
      tokens += t;
    }
    if (count > 0) chunks.push(current);
    return chunks;
  }

  /** One HTTP call with at most one retry; returns the parsed body and its usage. */
  private async send(state: DecisionRequest['state'], questions: Record<string, DecisionQuestion>, signal: AbortSignal): Promise<{ json: unknown; call: DecisionCallUsage }> {
    const body = JSON.stringify({ model: this.model, state, questions });
    const headers = { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' };
    const now = this.options.now ?? (() => Date.now());
    const started = now();
    for (let attempt = 0; ; attempt++) {
      const retry = async (): Promise<void> => pause(this.options.retryDelayMs?.() ?? 250 + Math.random() * 500, signal, this.id);
      let res: SystemOneFetchResponse;
      try {
        res = await this.fetchImpl(this.options.baseURL, { method: 'POST', headers, body, signal });
      } catch (err) {
        if (signal.aborted) throw abortError(this.id);
        if (attempt === 0) {
          await retry();
          continue;
        }
        throw new DecisionError('provider-error', `${this.id}: network error — ${err instanceof Error ? err.message : String(err)}`, this.id);
      }
      if (!res.ok && (res.status === 429 || res.status >= 500) && attempt === 0) {
        await retry();
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        const detail = errorText(text);
        throw new DecisionError('provider-error', `${this.id}: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`, this.id);
      }
      const json = this.parse(text);
      return { json, call: this.usageOf(json, body, now() - started) };
    }
  }

  private parse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new DecisionError('invalid-answer', `${this.id}: the response is not valid JSON (cut or malformed)`, this.id);
    }
  }

  private usageOf(parsed: unknown, body: string, durationMs: number): DecisionCallUsage {
    const json = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as { model?: unknown; usage?: { input_tokens?: unknown; cost?: unknown } };
    const reported = json.usage?.input_tokens;
    const inputTokens = typeof reported === 'number' && Number.isFinite(reported) ? reported : estimateTokens(body);
    const cost = json.usage?.cost;
    const price = this.options.usdPerMInputTokens ?? DEFAULT_USD_PER_M_INPUT;
    const costUsd = typeof cost === 'number' && Number.isFinite(cost) ? cost : (inputTokens * price) / 1_000_000;
    return { model: typeof json.model === 'string' && json.model ? json.model : this.model, inputTokens, costUsd, durationMs };
  }
}
