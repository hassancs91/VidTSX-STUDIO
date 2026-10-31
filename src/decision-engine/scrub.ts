/**
 * Error-message scrubbing (DECISION_MODELS_DESIGN.md §3: a `provider-error` message is scrubbed of any key and of the state text). The
 * secrets are the key, the state and each question's instructions (D-r16 frames put the evidence there). A message that still shares a
 * run of characters with a long secret after the replacements is withheld whole — a provider may echo a slice of what it was sent.
 */
import type { DecisionRequest } from './types';

const MAX_MESSAGE = 300;
/** A shared run this long with a secret means the message echoes it. */
const ECHO_WINDOW = 24;
const REDACTED = '[redacted]';
const WITHHELD = '[message withheld: it echoed the request]';

/** The texts no error message may carry for this request (the key first, when there is one). */
export function decisionSecrets(request: Pick<DecisionRequest, 'state' | 'questions'>, apiKey?: string): string[] {
  const out: string[] = [];
  if (apiKey) out.push(apiKey);
  out.push(typeof request.state === 'string' ? request.state : JSON.stringify(request.state));
  for (const q of Object.values(request.questions ?? {})) if (q && typeof q.instructions === 'string') out.push(q.instructions);
  return out.filter((s) => s.length >= 4);
}

function echoes(message: string, secret: string): boolean {
  if (secret.length < ECHO_WINDOW) return false;
  for (let i = 0; i + ECHO_WINDOW <= message.length; i++) {
    const window = message.slice(i, i + ECHO_WINDOW);
    if (window.includes(REDACTED)) continue;
    if (secret.includes(window)) return true;
  }
  return false;
}

/** `text` with every secret replaced, bearer tokens and `sk-…` keys masked, cut to 300 characters; withheld if it still echoes a secret. */
export function scrubDecisionText(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) out = out.split(secret).join(REDACTED);
  out = out.replace(/\bBearer\s+\S+/gi, `Bearer ${REDACTED}`).replace(/\bsk-[A-Za-z0-9_-]{4,}/g, REDACTED);
  if (secrets.some((s) => echoes(out, s))) return WITHHELD;
  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
}
