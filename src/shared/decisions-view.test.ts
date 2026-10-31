import { describe, expect, it } from 'vitest';
import type { DecisionsHostedRungStatus, DecisionsStatus } from './ipc/types/decisions';
import {
  addHostedRung,
  decisionsNowText,
  hostedRungViews,
  keyDotsText,
  localRungText,
  moveHostedRung,
  normalizeOpenRouterModel,
  removeHostedRung,
} from './decisions-view';

const rung = (over: Partial<DecisionsHostedRungStatus> & Pick<DecisionsHostedRungStatus, 'id'>): DecisionsHostedRungStatus => ({
  name: over.id === 'jev' ? 'TypeSafe Jev' : 'Microsoft-Decision-1 (OpenRouter)',
  model: over.id === 'jev' ? 'jev-1.14.0' : 'microsoft/microsoft-decision-1',
  keyProvider: over.id === 'jev' ? 'typesafe' : 'openrouter',
  hasKey: false,
  enabled: true,
  available: false,
  why: 'no key',
  ...over,
});

const status = (over: Partial<DecisionsStatus> = {}): DecisionsStatus => ({
  mode: 'auto',
  hostedOrder: ['jev', 'openrouter-decisions'],
  openRouterModel: 'microsoft/microsoft-decision-1',
  jev: rung({ id: 'jev' }),
  'openrouter-decisions': rung({ id: 'openrouter-decisions' }),
  local: { state: 'none', available: false, why: 'no local model' },
  llm: { available: false, why: 'no text provider' },
  ...over,
});

describe('hostedRungViews — the order with has-key dots (D2 §8)', () => {
  it('lists the enabled rungs in the stored order, then the switched-off ones', () => {
    const views = hostedRungViews(
      status({
        hostedOrder: ['openrouter-decisions'],
        jev: rung({ id: 'jev', enabled: false, hasKey: true, why: 'switched off in Settings' }),
        'openrouter-decisions': rung({ id: 'openrouter-decisions', hasKey: true, available: true, why: undefined }),
      }),
    );
    expect(views.map((v) => [v.id, v.label, v.position, v.enabled, v.hasKey])).toEqual([
      ['openrouter-decisions', 'OpenRouter', 1, true, true],
      ['jev', 'Jev', null, false, true],
    ]);
    expect(views[0].stateText).toBe('ready');
    expect(views[1].stateText).toBe('switched off in Settings');
  });

  it('keeps the stored order when both are on', () => {
    const views = hostedRungViews(status({ hostedOrder: ['openrouter-decisions', 'jev'] }));
    expect(views.map((v) => v.id)).toEqual(['openrouter-decisions', 'jev']);
    expect(views.map((v) => v.position)).toEqual([1, 2]);
    expect(views[0].stateText).toBe('no key');
  });
});

describe('keyDotsText', () => {
  it('reads "Jev — key set · OpenRouter — key set" (D2 §8 wording)', () => {
    const s = status({
      jev: rung({ id: 'jev', hasKey: true }),
      'openrouter-decisions': rung({ id: 'openrouter-decisions', hasKey: true }),
    });
    expect(keyDotsText(s)).toBe('Jev — key set · OpenRouter — key set');
  });

  it('says "no key" for a rung without one, in the views order', () => {
    expect(keyDotsText(status({ hostedOrder: ['openrouter-decisions', 'jev'], jev: rung({ id: 'jev', hasKey: true }) }))).toBe(
      'OpenRouter — no key · Jev — key set',
    );
  });
});

describe('order edits — each hosted rung removable / re-orderable (D2 §8)', () => {
  it('moves a rung up or down, bounded', () => {
    expect(moveHostedRung(['jev', 'openrouter-decisions'], 'openrouter-decisions', -1)).toEqual(['openrouter-decisions', 'jev']);
    expect(moveHostedRung(['jev', 'openrouter-decisions'], 'jev', 1)).toEqual(['openrouter-decisions', 'jev']);
    expect(moveHostedRung(['jev', 'openrouter-decisions'], 'jev', -1)).toEqual(['jev', 'openrouter-decisions']);
    expect(moveHostedRung(['jev'], 'openrouter-decisions', -1)).toEqual(['jev']);
  });

  it('removes a rung (even the last — an empty order is allowed) and adds one back at the end, once', () => {
    expect(removeHostedRung(['jev', 'openrouter-decisions'], 'jev')).toEqual(['openrouter-decisions']);
    expect(removeHostedRung(['openrouter-decisions'], 'openrouter-decisions')).toEqual([]);
    expect(addHostedRung(['openrouter-decisions'], 'jev')).toEqual(['openrouter-decisions', 'jev']);
    expect(addHostedRung(['jev'], 'jev')).toEqual(['jev']);
  });

  it('never mutates its input', () => {
    const order = ['jev', 'openrouter-decisions'] as const;
    const copy = [...order];
    moveHostedRung(copy, 'jev', 1);
    removeHostedRung(copy, 'jev');
    addHostedRung(copy, 'jev');
    expect(copy).toEqual([...order]);
  });
});

describe('localRungText — D3 failed, so no Download button', () => {
  it('reads "none available"', () => {
    expect(localRungText(status())).toBe('none available');
  });
});

describe('decisionsNowText — plain words, no number', () => {
  it('off', () => {
    expect(decisionsNowText(status({ mode: 'off' }))).toMatch(/^Off/);
  });

  it('names the first available rung in the order', () => {
    const s = status({
      hostedOrder: ['jev', 'openrouter-decisions'],
      'openrouter-decisions': rung({ id: 'openrouter-decisions', hasKey: true, available: true, why: undefined }),
    });
    expect(decisionsNowText(s)).toBe('Answers come from OpenRouter');
  });

  it('says what to do when no rung is ready', () => {
    expect(decisionsNowText(status())).toMatch(/AI → Providers/);
    expect(decisionsNowText(status({ llm: { available: true } }))).toMatch(/uncalibrated/);
  });

  it('never carries a digit', () => {
    for (const s of [status(), status({ mode: 'off' }), status({ llm: { available: true } })]) {
      expect(decisionsNowText(s)).not.toMatch(/\d/);
    }
  });
});

describe('normalizeOpenRouterModel', () => {
  it('trims, refuses blank and inner whitespace', () => {
    expect(normalizeOpenRouterModel('  microsoft/microsoft-decision-1 ')).toBe('microsoft/microsoft-decision-1');
    expect(normalizeOpenRouterModel('   ')).toBeNull();
    expect(normalizeOpenRouterModel('microsoft/ decision')).toBeNull();
  });
});
