/**
 * The LLM fallback (DECISION_MODELS_DESIGN.md §5.4) — the app's text provider answering JSON, so a flow or agent keeps working with no
 * decider key. One prompt per request listing the questions and their allowed answers; a strict parse (one JSON object, optionally in one
 * ```json fence); a missing / extra key, an answer off the list or a cut text → `invalid-answer` (P11: a text can arrive cut and marked
 * success). The chosen answer gets probability 1.0. Never calibrated (calibration-table.ts: `llm` is never a row); `auto` reaches it only
 * with `allowUncalibrated`. `generate` is injected — main passes `llmEngine.generate` (structurally this signature).
 */
import { decisionSecrets, scrubDecisionText } from '../scrub';
import {
  DecisionError,
  type DecisionAnswer,
  type DecisionLimits,
  type DecisionProvider,
  type DecisionProviderOutput,
  type DecisionProviderReadiness,
  type DecisionQuestion,
  type DecisionRequest,
} from '../types';

/** The slice of the text engine's request the fallback sends (`LLMRequest`-compatible). */
export interface LlmFallbackGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** The slice of the text engine's response the fallback reads (`LLMResponse`-compatible). */
export interface LlmFallbackGenerateResponse {
  text: string;
  model: string;
  usage?: { inputTokens: number; costUsd?: number };
}

export type LlmFallbackGenerate = (request: LlmFallbackGenerateRequest) => Promise<LlmFallbackGenerateResponse>;

export interface LlmFallbackProviderOptions {
  generate: LlmFallbackGenerate;
  /** A label for the requested model (the served one comes back in the output). */
  model?: string;
  /** Is a text provider configured? (default: yes). */
  isReady?: () => Promise<boolean>;
}

/** One prompt carries every question and its answer: kept well under a text model's comfortable output. */
const LLM_LIMITS: DecisionLimits = { maxOptions: 255, maxLevels: 10, maxStateTokens: 64_000, maxQuestions: 100 };

const SYSTEM_PROMPT =
  'You answer typed questions about a state. Reply with ONE JSON object and nothing else: exactly one key per question, the keys ' +
  'listed. A yes / no question takes true or false; a choice question takes one of its option ids, verbatim; a score question takes one ' +
  'of its levels, verbatim. No prose, no extra keys.';

class Unreadable extends Error {}

function describeQuestion(key: string, q: DecisionQuestion): string {
  if (q.type === 'noul') {
    const meaning = q.criteria ? ` (true = ${q.criteria.true}; false = ${q.criteria.false})` : '';
    return `- ${JSON.stringify(key)} — yes / no, answer true or false${meaning}: ${q.instructions}`;
  }
  if (q.type === 'choice') {
    const options = Object.entries(q.criteria).map(([id, text]) => `${JSON.stringify(id)} (${text})`);
    return `- ${JSON.stringify(key)} — choice, one of ${options.join(', ')}: ${q.instructions}`;
  }
  return `- ${JSON.stringify(key)} — score, one of the levels ${q.criteria.map((l) => JSON.stringify(l)).join(', ')} (lowest first): ${q.instructions}`;
}

function buildPrompt(request: DecisionRequest): string {
  const state = typeof request.state === 'string' ? request.state : JSON.stringify(request.state, null, 1);
  const keys = Object.keys(request.questions);
  const lines = Object.entries(request.questions).map(([key, q]) => describeQuestion(key, q));
  return `State:\n${state}\n\nQuestions:\n${lines.join('\n')}\n\nAnswer with one JSON object whose keys are exactly: ${keys.map((k) => JSON.stringify(k)).join(', ')}.`;
}

/** The one JSON object in `text` (bare or in a single ```json fence), or throw. */
function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed);
  let value: unknown;
  try {
    value = JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new Unreadable('the text is not one JSON object (cut or malformed)');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Unreadable('the text is not one JSON object');
  return value as Record<string, unknown>;
}

function oneHot(options: readonly string[], chosen: string): Record<string, number> {
  return Object.fromEntries(options.map((o) => [o, o === chosen ? 1 : 0]));
}

function readAnswer(key: string, value: unknown, q: DecisionQuestion): DecisionAnswer {
  if (q.type === 'noul') {
    if (typeof value !== 'boolean') throw new Unreadable(`question "${key}" — not true or false`);
    return { type: 'noul', p: value ? 1 : 0 };
  }
  if (q.type === 'choice') {
    const options = Object.keys(q.criteria);
    if (typeof value !== 'string' || !options.includes(value)) throw new Unreadable(`question "${key}" — an option the caller did not send`);
    return { type: 'choice', choice: value, probabilities: oneHot(options, value), confidence: 1 };
  }
  const index = typeof value === 'string' ? q.criteria.indexOf(value) : -1;
  if (index < 0) throw new Unreadable(`question "${key}" — a level the caller did not send`);
  return { type: 'score', score: index, probabilities: oneHot(q.criteria, q.criteria[index]), confidence: 1 };
}

function readAnswers(text: string, questions: Record<string, DecisionQuestion>): Record<string, DecisionAnswer> {
  const json = parseObject(text);
  const asked = Object.keys(questions);
  const extra = Object.keys(json).filter((k) => !asked.includes(k));
  if (extra.length > 0) throw new Unreadable(`${extra.length} key(s) nobody asked for`);
  const out: Record<string, DecisionAnswer> = {};
  for (const key of asked) {
    if (!(key in json)) throw new Unreadable(`question "${key}" has no answer`);
    out[key] = readAnswer(key, json[key], questions[key]);
  }
  return out;
}

export class LlmFallbackProvider implements DecisionProvider {
  readonly id = 'llm' as const;
  readonly model: string;
  private readonly options: LlmFallbackProviderOptions;

  constructor(options: LlmFallbackProviderOptions) {
    this.options = options;
    this.model = options.model ?? 'default text provider';
  }

  limits(): DecisionLimits {
    return { ...LLM_LIMITS };
  }

  async checkReady(): Promise<DecisionProviderReadiness> {
    const ready = this.options.isReady ? await this.options.isReady() : true;
    return ready ? { ready: true } : { ready: false, reason: 'no text provider' };
  }

  async decide(request: DecisionRequest, signal: AbortSignal): Promise<DecisionProviderOutput> {
    const secrets = decisionSecrets(request);
    if (signal.aborted) throw new DecisionError('cancelled', 'llm: the request was aborted', this.id);
    const questionCount = Object.keys(request.questions).length;
    let response: LlmFallbackGenerateResponse;
    try {
      response = await this.options.generate({
        prompt: buildPrompt(request),
        systemPrompt: SYSTEM_PROMPT,
        maxTokens: Math.min(8192, 256 + 48 * questionCount),
        temperature: 0,
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw new DecisionError('cancelled', 'llm: the request was aborted', this.id);
      const message = `llm: the text provider failed — ${err instanceof Error ? err.message : String(err)}`;
      throw new DecisionError('provider-error', scrubDecisionText(message, secrets), this.id);
    }
    try {
      const answers = readAnswers(response.text, request.questions);
      const usage = { inputTokens: response.usage?.inputTokens ?? 0, costUsd: response.usage?.costUsd ?? 0 };
      return { answers, model: response.model || this.model, usage };
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err;
      throw new DecisionError('invalid-answer', scrubDecisionText(`llm: ${err.message}`, secrets), this.id);
    }
  }
}
