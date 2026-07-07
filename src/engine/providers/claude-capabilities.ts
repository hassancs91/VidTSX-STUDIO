import type { EffortLevel } from "../types";

function normalize(model: string): string {
  return model.toLowerCase().replace(/^anthropic\//, "");
}

export function supportsAdaptiveThinking(model: string): boolean {
  const m = normalize(model);
  return (
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6") ||
    m.startsWith("claude-mythos")
  );
}

export function supportsEffort(model: string): boolean {
  const m = normalize(model);
  return (
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6") ||
    m.startsWith("claude-opus-4-5") ||
    m.startsWith("claude-mythos")
  );
}

export function supportsXhigh(model: string): boolean {
  return normalize(model).startsWith("claude-opus-4-7");
}

export function supportsMax(model: string): boolean {
  const m = normalize(model);
  return (
    m.startsWith("claude-opus-4-7") ||
    m.startsWith("claude-opus-4-6") ||
    m.startsWith("claude-sonnet-4-6") ||
    m.startsWith("claude-mythos")
  );
}

/**
 * Opus 4.7 silently defaults thinking.display to "omitted" — thinking text is
 * empty unless we opt back into "summarized". Billing is identical.
 */
export function requiresExplicitThinkingDisplay(model: string): boolean {
  const m = normalize(model);
  return m.startsWith("claude-opus-4-7") || m.startsWith("claude-mythos");
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
