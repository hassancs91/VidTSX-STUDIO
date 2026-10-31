/**
 * Reading a System One response's `answers` (DECISION_MODELS_DESIGN.md §5.1, §3): `noul` → `p`; `choice` / `score` with `probabilities`
 * renormalised over the caller's options and `confidence` unchanged (the top probability when the provider sends none). Anything that
 * cannot be read — a missing answer, a wrong type, an option the caller did not send, a number outside [0, 1] — is `invalid-answer`.
 * Messages name question keys and options only, never the state or the instructions.
 */
import { DecisionError, type DecisionAnswer, type DecisionProviderId, type DecisionQuestion } from '../types';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isUnit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

class Unreadable extends Error {}

/** Probabilities keyed by `options` (missing → 0), renormalised; `alias` maps another key the provider may use onto an option. */
function readProbabilities(raw: unknown, options: readonly string[], alias: (key: string) => string | undefined, fallback: string | undefined): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]));
  if (raw === undefined || raw === null) {
    if (fallback === undefined) throw new Unreadable('no probabilities and no choice');
    out[fallback] = 1;
    return out;
  }
  if (!isObject(raw)) throw new Unreadable('probabilities is not an object');
  let sum = 0;
  for (const [key, value] of Object.entries(raw)) {
    const option = options.includes(key) ? key : alias(key);
    if (option === undefined) throw new Unreadable(`an option the caller did not send ("${key.slice(0, 40)}")`);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Unreadable(`a bad probability for "${option}"`);
    out[option] += value;
    sum += value;
  }
  if (sum <= 0) throw new Unreadable('the probabilities sum to 0');
  for (const o of options) out[o] = out[o] / sum;
  return out;
}

function top(probabilities: Record<string, number>): string {
  let best = '';
  let bestP = -1;
  for (const [option, p] of Object.entries(probabilities)) if (p > bestP) [best, bestP] = [option, p];
  return best;
}

function readOne(raw: unknown, question: DecisionQuestion): DecisionAnswer {
  if (!isObject(raw)) throw new Unreadable('no answer');
  if (raw.type === 'refused' || raw.type === 'refusal') return { type: 'refused', reason: 'the provider refused this question' };
  if (raw.type !== undefined && raw.type !== question.type) throw new Unreadable(`a ${String(raw.type).slice(0, 20)} answer to a ${question.type} question`);

  if (question.type === 'noul') {
    if (!isUnit(raw.noul)) throw new Unreadable('noul is not a probability');
    return { type: 'noul', p: raw.noul };
  }

  if (question.type === 'choice') {
    const options = Object.keys(question.criteria);
    const named = raw.choice;
    if (named !== undefined && (typeof named !== 'string' || !options.includes(named))) throw new Unreadable('a choice the caller did not send');
    const probabilities = readProbabilities(raw.probabilities, options, () => undefined, named);
    const choice = named ?? top(probabilities);
    return { type: 'choice', choice, probabilities, confidence: isUnit(raw.confidence) ? raw.confidence : probabilities[choice] };
  }

  const levels = question.criteria;
  const byIndex = (key: string): string | undefined => (/^\d+$/.test(key) ? levels[Number(key)] : undefined);
  const named = typeof raw.score === 'number' && Number.isInteger(raw.score) ? levels[raw.score] : undefined;
  const probabilities = readProbabilities(raw.probabilities, levels, byIndex, named);
  const score = levels.reduce((sum, level, i) => sum + probabilities[level] * i, 0);
  return { type: 'score', score, probabilities, confidence: isUnit(raw.confidence) ? raw.confidence : probabilities[top(probabilities)] };
}

/** Map `json.answers` onto every asked question (extra answers are ignored), or throw `invalid-answer`. */
export function readSystemOneAnswers(json: unknown, questions: Record<string, DecisionQuestion>, provider: DecisionProviderId): Record<string, DecisionAnswer> {
  if (!isObject(json) || !isObject(json.answers)) throw new DecisionError('invalid-answer', `${provider}: the response has no answers object`, provider);
  const answers = json.answers;
  const out: Record<string, DecisionAnswer> = {};
  for (const [key, question] of Object.entries(questions)) {
    try {
      out[key] = readOne(answers[key], question);
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err;
      throw new DecisionError('invalid-answer', `${provider}: question "${key.slice(0, 60)}" — ${err.message}`, provider);
    }
  }
  return out;
}
