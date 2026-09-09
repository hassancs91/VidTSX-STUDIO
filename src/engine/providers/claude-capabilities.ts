import type { EffortLevel } from "../types";

/** OpenRouter names Claude with dots ("anthropic/claude-opus-4.8"); the
 *  first-party ids use hyphens. Both must hit the same capability rows. */
function normalize(model: string): string {
  return model.toLowerCase().replace(/^anthropic\//, "").replace(/\./g, "-");
}

/**
 * The Claude 5 family (Fable 5/5.1, Opus 5, Sonnet 5) and Opus 4.8 share one
 * surface: adaptive thinking is the only on-mode, effort runs low…max
 * including xhigh, and thinking text is omitted unless display is asked for.
 * Fable/Mythos additionally have thinking ALWAYS on (disabled → 400), which
 * the engine never sends — an absent `thinking` runs adaptive there.
 */
function isClaude5Surface(m: string): boolean {
  return (
    m.startsWith("claude-fable") ||
    m.startsWith("claude-mythos") ||
    m.startsWith("claude-opus-5") ||
    m.startsWith("claude-sonnet-5") ||
    m.startsWith("claude-opus-4-8")
  );
}

export function supportsAdaptiveThinking(model: string): boolean {
  const m = normalize(model);
  return (
    isClaude5Surface(m) ||
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6")
  );
}

export function supportsEffort(model: string): boolean {
  const m = normalize(model);
  return (
    isClaude5Surface(m) ||
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6") ||
    m.startsWith("claude-opus-4-5")
  );
}

export function supportsXhigh(model: string): boolean {
  const m = normalize(model);
  return isClaude5Surface(m) || m.startsWith("claude-opus-4-7");
}

export function supportsMax(model: string): boolean {
  const m = normalize(model);
  return (
    isClaude5Surface(m) ||
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6")
  );
}

/**
 * Opus 4.7 and everything after it default thinking.display to "omitted" —
 * thinking text is empty unless we opt back into "summarized". Billing is
 * identical.
 */
export function requiresExplicitThinkingDisplay(model: string): boolean {
  const m = normalize(model);
  return isClaude5Surface(m) || m.startsWith("claude-opus-4-7");
}

/**
 * Resolves an effort request against a model's capabilities.
 * - xhigh → high on models that don't support xhigh
 * - max → high on models that don't support max
 * - any level → undefined on models that don't support effort at all
 */
export function resolveEffort(
  model: string,
  requested: EffortLevel | undefined,
): EffortLevel | undefined {
  if (!requested) return undefined;
  if (!supportsEffort(model)) return undefined;
  if (requested === "xhigh" && !supportsXhigh(model)) return "high";
  if (requested === "max" && !supportsMax(model)) return "high";
  return requested;
}
