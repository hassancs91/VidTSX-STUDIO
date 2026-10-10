// Caps and cancel for one builder run (TSX_BUILDER_DESIGN.md T6). One
// AbortController stops everything — the SDK session, and through the tools
// any bundle or renderStill in flight — whether the caller cancelled, the
// wall clock ran out or the output tokens did. The first reason wins. The
// turn cap is the SDK's own maxTurns; tsx-builder.ts matches its error.

import type { LLMTurnUsage } from '../../../engine/types';
import type { BuildBudget, BuildCaps, BuildStopReason, BuildTokens } from './types';

/**
 * Generous on purpose: the look budget is the real limit, a cap only stops a
 * runaway. Measured in P0: Quick smoke 13 turns / 4.6k output tokens; Craft
 * B2 run 2 46 turns / 32.6k output tokens / 7.7 min.
 */
export const BUDGET_CAPS: Record<BuildBudget, BuildCaps> = {
  quick: { turns: 40, minutes: 15, outputTokens: 40_000 },
  standard: { turns: 90, minutes: 30, outputTokens: 100_000 },
  craft: { turns: 200, minutes: 60, outputTokens: 250_000 },
};

export function capsFor(budget: BuildBudget, overrides: { maxMinutes?: number; maxOutputTokens?: number } = {}): BuildCaps {
  return {
    ...BUDGET_CAPS[budget],
    ...(overrides.maxMinutes ? { minutes: overrides.maxMinutes } : {}),
    ...(overrides.maxOutputTokens ? { outputTokens: overrides.maxOutputTokens } : {}),
  };
}

export type GuardStop = 'cancelled' | 'cap-time' | 'cap-tokens';

export interface RunGuardHooks {
  /** After a turn is counted, before the token cap is checked. */
  onTurn?: (usage: LLMTurnUsage) => void;
  /** Once, when the first stop reason fires, before the abort goes out. */
  onStop?: (reason: GuardStop) => void;
}

export class RunGuard {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopReason: GuardStop | null = null;
  readonly tokens: BuildTokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  turns = 0;

  constructor(
    readonly caps: BuildCaps,
    private readonly callerSignal?: AbortSignal,
    private readonly hooks: RunGuardHooks = {},
  ) {}

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** The first stop reason, or null while the run is free to go on. */
  get reason(): GuardStop | null {
    return this.stopReason;
  }

  /** Start the clock and listen for the caller's cancel. */
  arm(): void {
    if (this.callerSignal?.aborted) {
      this.stop('cancelled');
      return;
    }
    this.callerSignal?.addEventListener('abort', this.onCallerAbort, { once: true });
    this.timer = setTimeout(() => this.stop('cap-time'), this.caps.minutes * 60_000);
  }

  /** One API response finished: count it, then hold the token cap. */
  addTurn(usage: LLMTurnUsage): void {
    this.turns += 1;
    this.tokens.input += usage.inputTokens;
    this.tokens.output += usage.outputTokens;
    this.tokens.cacheRead += usage.cacheReadInputTokens;
    this.tokens.cacheCreation += usage.cacheCreationInputTokens;
    try {
      this.hooks.onTurn?.(usage);
    } catch {
      /* a listener must not break the count */
    }
    if (this.tokens.output >= this.caps.outputTokens) this.stop('cap-tokens');
  }

  stop(reason: GuardStop): void {
    if (this.stopReason) return;
    this.stopReason = reason;
    this.disarm();
    try {
      this.hooks.onStop?.(reason);
    } catch {
      /* a listener must not keep the run alive */
    }
    this.controller.abort();
  }

  /**
   * The session is over. Abort whatever is still in flight (a tool the session
   * left running when it ended on an error) without recording a stop reason.
   */
  end(): void {
    this.disarm();
    if (!this.controller.signal.aborted) this.controller.abort();
  }

  private disarm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.callerSignal?.removeEventListener('abort', this.onCallerAbort);
  }

  private readonly onCallerAbort = (): void => this.stop('cancelled');
}

/** Why the run ended. A `finish` accepted before any stop wins: that build is done. */
export function resolveStopReason(finished: boolean, guard: GuardStop | null, maxTurnsHit: boolean): BuildStopReason {
  if (finished) return 'finished';
  if (guard) return guard;
  if (maxTurnsHit) return 'cap-turns';
  return 'error';
}

export function stopMessage(reason: BuildStopReason, caps: BuildCaps, responseError?: string): string | undefined {
  switch (reason) {
    case 'finished':
      return undefined;
    case 'cancelled':
      return 'Cancelled.';
    case 'cap-time':
      return `Stopped at the ${caps.minutes}-minute cap.`;
    case 'cap-tokens':
      return `Stopped at the ${Math.round(caps.outputTokens / 1000)}k output-token cap.`;
    case 'cap-turns':
      return `Stopped at the ${caps.turns}-turn cap.`;
    default:
      return responseError ?? 'The builder stopped without calling finish.';
  }
}
