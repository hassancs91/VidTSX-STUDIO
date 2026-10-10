import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUDGET_CAPS, capsFor, resolveStopReason, RunGuard, stopMessage } from './build-run-guard';

const turn = (n: number, outputTokens: number) => ({
  turn: n,
  inputTokens: 2,
  outputTokens,
  cacheReadInputTokens: 1000,
  cacheCreationInputTokens: 50,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('capsFor', () => {
  it('takes the budget caps and the request overrides', () => {
    expect(capsFor('craft')).toEqual(BUDGET_CAPS.craft);
    expect(capsFor('quick', { maxMinutes: 5, maxOutputTokens: 9000 })).toEqual({ turns: 40, minutes: 5, outputTokens: 9000 });
  });
});

describe('RunGuard', () => {
  it('sums every turn and stops at the output-token cap, reporting before it aborts', () => {
    const order: string[] = [];
    const guard = new RunGuard({ turns: 40, minutes: 15, outputTokens: 1000 }, undefined, {
      onTurn: (u) => order.push(`turn ${u.turn}`),
      onStop: (reason) => order.push(`stop ${reason} aborted=${guard.signal.aborted}`),
    });
    guard.arm();
    guard.addTurn(turn(1, 600));
    expect(guard.signal.aborted).toBe(false);
    guard.addTurn(turn(2, 400));
    expect(guard.reason).toBe('cap-tokens');
    expect(guard.signal.aborted).toBe(true);
    expect(order).toEqual(['turn 1', 'turn 2', 'stop cap-tokens aborted=false']);
    expect(guard.turns).toBe(2);
    expect(guard.tokens).toEqual({ input: 4, output: 1000, cacheRead: 2000, cacheCreation: 100 });
  });

  it('stops at the wall-clock cap', () => {
    vi.useFakeTimers();
    const guard = new RunGuard({ turns: 40, minutes: 2, outputTokens: 1000 });
    guard.arm();
    vi.advanceTimersByTime(119_000);
    expect(guard.reason).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(guard.reason).toBe('cap-time');
    expect(guard.signal.aborted).toBe(true);
  });

  it('stops on the caller cancel, and the first reason wins', () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const onStop = vi.fn();
    const guard = new RunGuard({ turns: 40, minutes: 1, outputTokens: 10 }, caller.signal, { onStop });
    guard.arm();
    caller.abort();
    guard.addTurn(turn(1, 500));
    vi.advanceTimersByTime(120_000);
    expect(guard.reason).toBe('cancelled');
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledWith('cancelled');
  });

  it('stops at once when the caller had already cancelled', () => {
    const caller = new AbortController();
    caller.abort();
    const guard = new RunGuard(BUDGET_CAPS.quick, caller.signal);
    guard.arm();
    expect(guard.reason).toBe('cancelled');
    expect(guard.signal.aborted).toBe(true);
  });

  it('end() aborts whatever is in flight without recording a stop, and disarms the clock', () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const guard = new RunGuard({ turns: 40, minutes: 1, outputTokens: 10 }, caller.signal);
    guard.arm();
    guard.end();
    expect(guard.signal.aborted).toBe(true);
    caller.abort();
    vi.advanceTimersByTime(120_000);
    expect(guard.reason).toBeNull();
  });

  it('survives throwing listeners', () => {
    const guard = new RunGuard({ turns: 40, minutes: 1, outputTokens: 10 }, undefined, {
      onTurn: () => {
        throw new Error('turn listener');
      },
      onStop: () => {
        throw new Error('stop listener');
      },
    });
    guard.arm();
    expect(() => guard.addTurn(turn(1, 50))).not.toThrow();
    expect(guard.signal.aborted).toBe(true);
    guard.end();
  });
});

describe('resolveStopReason / stopMessage', () => {
  it('a finish accepted before a stop wins; a guard stop beats the SDK turn cap', () => {
    expect(resolveStopReason(true, 'cancelled', false)).toBe('finished');
    expect(resolveStopReason(false, 'cap-tokens', true)).toBe('cap-tokens');
    expect(resolveStopReason(false, null, true)).toBe('cap-turns');
    expect(resolveStopReason(false, null, false)).toBe('error');
  });

  it('names the cap that stopped the run', () => {
    const caps = { turns: 90, minutes: 30, outputTokens: 100_000 };
    expect(stopMessage('finished', caps)).toBeUndefined();
    expect(stopMessage('cap-tokens', caps)).toBe('Stopped at the 100k output-token cap.');
    expect(stopMessage('cap-time', caps)).toBe('Stopped at the 30-minute cap.');
    expect(stopMessage('cap-turns', caps)).toBe('Stopped at the 90-turn cap.');
    expect(stopMessage('error', caps, 'Usage limit reached')).toBe('Usage limit reached');
    expect(stopMessage('error', caps)).toBe('The builder stopped without calling finish.');
  });
});
