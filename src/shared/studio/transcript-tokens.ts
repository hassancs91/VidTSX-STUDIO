// The two transcript conventions the agent's takes view and the Transcript
// panel must agree on, so what the user sees tinted is exactly what the agent
// sees marked: where a take ends, and what counts as a filler.

/** Speech gap that starts a new take segment, seconds. */
export const TAKE_GAP_SECONDS = 0.8;

/**
 * The only hard-coded filler vocabulary (reference FILLERS set). Matched
 * case-insensitively after stripping trailing punctuation.
 */
const FILLERS = new Set(['um', 'uh', 'erm', 'hmm', 'mm', 'mhm', 'uhm']);

export function isFillerWord(token: string): boolean {
  return FILLERS.has(token.toLowerCase().replace(/[.,?!]+$/, ''));
}
