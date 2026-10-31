/**
 * Request validation (DECISION_MODELS_DESIGN.md §4 `validate.ts`): the request shape + the per-type rules — choice 2..255 options,
 * score 2–10 levels, non-empty instructions, at least one question, a state size limit. Pure; takes `unknown` because IPC input is
 * untyped. Malformed → `invalid-request`; over every adapter's ceiling → `unsupported` (§3). A reason names question keys (the caller's
 * own names) but never the state text.
 */
import { DECISION_PROVIDER_IDS } from '../shared/types/decisions';
import type { DecisionProviderChoice, DecisionQuestion, DecisionRequest, DecisionTaskFamily } from './types';

/** The widest adapter in this slice (Jev, §5.1: 255 options, 10 levels, 64k tokens per request); questions are packed / split by it. */
export const DECISION_REQUEST_CEILING = {
  maxOptions: 255,
  maxLevels: 10,
  maxStateTokens: 64_000,
  maxQuestions: 1_000,
} as const;

/** What the ladder compares against each provider's `limits()`. */
export interface DecisionRequestMeasure {
  questionCount: number;
  /** Widest `choice` (0 when there is none). */
  maxOptions: number;
  /** Deepest `score` (0 when there is none). */
  maxLevels: number;
  /** `estimateTokens` of the state (a string as is, anything else as JSON). */
  stateTokens: number;
}

export type DecisionValidation =
  | { ok: true; request: DecisionRequest; measure: DecisionRequestMeasure }
  | { ok: false; code: 'invalid-request' | 'unsupported'; reason: string };

const FAMILIES: readonly DecisionTaskFamily[] = ['routing', 'verify', 'other'];
const encoder = new TextEncoder();

/** A conservative token estimate with no tokenizer: ceil(UTF-8 bytes / 3) (English ~4 chars per token; Arabic letters are 2 bytes). */
export function estimateTokens(text: string): number {
  return Math.ceil(encoder.encode(text).length / 3);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

class Invalid extends Error {
  constructor(
    readonly code: 'invalid-request' | 'unsupported',
    reason: string,
  ) {
    super(reason);
  }
}

function fail(reason: string): never {
  throw new Invalid('invalid-request', reason);
}

function tooBig(reason: string): never {
  throw new Invalid('unsupported', reason);
}

function readQuestion(key: string, raw: unknown): DecisionQuestion {
  if (!isRecord(raw)) fail(`question '${key}' must be an object`);
  if (!nonEmpty(raw.instructions)) fail(`question '${key}' needs non-empty instructions`);
  const instructions = raw.instructions;
  if (raw.type === 'noul') {
    if (raw.criteria === undefined) return { type: 'noul', instructions };
    const c = raw.criteria;
    if (!isRecord(c) || !nonEmpty(c.true) || !nonEmpty(c.false)) fail(`question '${key}': noul criteria needs non-empty true and false`);
    return { type: 'noul', instructions, criteria: { true: c.true, false: c.false } };
  }
  if (raw.type === 'choice') {
    if (!isRecord(raw.criteria)) fail(`question '${key}': choice criteria must map option ids to descriptions`);
    const entries = Object.entries(raw.criteria);
    if (entries.length < 2) fail(`question '${key}' needs 2 to ${DECISION_REQUEST_CEILING.maxOptions} options`);
    if (entries.length > DECISION_REQUEST_CEILING.maxOptions) {
      tooBig(`question '${key}' has ${entries.length} options; no provider takes more than ${DECISION_REQUEST_CEILING.maxOptions}`);
    }
    const criteria: Record<string, string> = {};
    for (const [id, description] of entries) {
      if (id.trim().length === 0 || !nonEmpty(description)) fail(`question '${key}': every option needs an id and a description`);
      criteria[id] = description;
    }
    return { type: 'choice', instructions, criteria };
  }
  if (raw.type === 'score') {
    if (!Array.isArray(raw.criteria)) fail(`question '${key}': score criteria must be an ordered list of levels`);
    const levels: unknown[] = raw.criteria;
    if (levels.length < 2) fail(`question '${key}' needs 2 to ${DECISION_REQUEST_CEILING.maxLevels} levels`);
    if (levels.length > DECISION_REQUEST_CEILING.maxLevels) {
      tooBig(`question '${key}' has ${levels.length} levels; no provider takes more than ${DECISION_REQUEST_CEILING.maxLevels}`);
    }
    if (!levels.every(nonEmpty)) fail(`question '${key}': every level must be non-empty text`);
    return { type: 'score', instructions, criteria: levels.filter(nonEmpty) };
  }
  return fail(`question '${key}' has an unknown type (noul, choice or score)`);
}

function readState(raw: unknown): { state: DecisionRequest['state']; tokens: number } {
  if (typeof raw === 'string') {
    if (raw.trim().length === 0) fail('state must not be empty');
    return { state: raw, tokens: estimateTokens(raw) };
  }
  if (Array.isArray(raw) || isRecord(raw)) return { state: raw, tokens: estimateTokens(JSON.stringify(raw)) };
  return fail('state must be text, an object or a list');
}

function readOptional(input: Record<string, unknown>): Pick<DecisionRequest, 'provider' | 'allowUncalibrated' | 'timeoutMs' | 'family'> {
  const out: Pick<DecisionRequest, 'provider' | 'allowUncalibrated' | 'timeoutMs' | 'family'> = {};
  const { provider, allowUncalibrated, timeoutMs, family } = input;
  if (provider !== undefined) {
    const known: readonly unknown[] = ['auto', ...DECISION_PROVIDER_IDS];
    if (!known.includes(provider)) fail(`provider must be one of ${known.join(', ')}`);
    out.provider = provider as DecisionProviderChoice;
  }
  if (allowUncalibrated !== undefined) {
    if (typeof allowUncalibrated !== 'boolean') fail('allowUncalibrated must be true or false');
    out.allowUncalibrated = allowUncalibrated;
  }
  if (timeoutMs !== undefined) {
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) fail('timeoutMs must be a positive number');
    out.timeoutMs = timeoutMs;
  }
  if (family !== undefined) {
    const known: readonly unknown[] = FAMILIES;
    if (!known.includes(family)) fail(`family must be one of ${FAMILIES.join(', ')}`);
    out.family = family as DecisionTaskFamily;
  }
  return out;
}

function validate(input: unknown): { request: DecisionRequest; measure: DecisionRequestMeasure } {
  if (!isRecord(input)) fail('a decision request must be an object');
  const { state, tokens } = readState(input.state);
  if (tokens > DECISION_REQUEST_CEILING.maxStateTokens) {
    tooBig(`the state is about ${tokens} tokens; no provider takes more than ${DECISION_REQUEST_CEILING.maxStateTokens}`);
  }
  if (!isRecord(input.questions)) fail('questions must be an object keyed by question name');
  const keys = Object.keys(input.questions);
  if (keys.length === 0) fail('a decision request needs at least one question');
  if (keys.length > DECISION_REQUEST_CEILING.maxQuestions) {
    tooBig(`${keys.length} questions; no provider takes more than ${DECISION_REQUEST_CEILING.maxQuestions} in one request`);
  }
  if (!nonEmpty(input.featureSource)) fail('featureSource is required');

  const questions: Record<string, DecisionQuestion> = {};
  let maxOptions = 0;
  let maxLevels = 0;
  for (const key of keys) {
    if (key.trim().length === 0) fail('every question needs a non-empty name');
    const q = readQuestion(key, input.questions[key]);
    if (q.type === 'choice') maxOptions = Math.max(maxOptions, Object.keys(q.criteria).length);
    if (q.type === 'score') maxLevels = Math.max(maxLevels, q.criteria.length);
    questions[key] = q;
  }

  const request: DecisionRequest = {
    state,
    questions,
    featureSource: input.featureSource as DecisionRequest['featureSource'],
    ...readOptional(input),
  };
  return { request, measure: { questionCount: keys.length, maxOptions, maxLevels, stateTokens: tokens } };
}

/** Validate an untyped request; on success returns a clean copy (unknown fields dropped) and its measure for the ladder. */
export function validateDecisionRequest(input: unknown): DecisionValidation {
  try {
    return { ok: true, ...validate(input) };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, code: err.code, reason: err.message };
    throw err;
  }
}
