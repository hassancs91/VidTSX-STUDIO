import { describe, expect, it, vi } from 'vitest';

// capture-script → library-paths/store → settings → electron (filing pattern).
vi.mock('electron', () => ({
  app: { getPath: () => '', isPackaged: false },
}));

import {
  SCRIPT_MAX_CAPTURES,
  SCRIPT_MAX_STEPS,
  scriptedStillDescription,
  validateCaptureScript,
  type CaptureScriptStep,
} from './capture-script';

const cap = (label = 'still'): CaptureScriptStep => ({ op: 'capture', label });

describe('validateCaptureScript', () => {
  it('accepts a typical multi-state script', () => {
    const steps: CaptureScriptStep[] = [
      { op: 'wait', selector: 'nav' },
      cap('homepage top'),
      { op: 'click', selector: 'button.menu' },
      cap('menu open'),
      { op: 'scroll', to: 'bottom' },
      cap('footer'),
    ];
    expect(validateCaptureScript(steps)).toBeNull();
  });

  it('rejects empty scripts and scripts that never capture', () => {
    expect(validateCaptureScript([])).toMatch(/no steps/);
    expect(validateCaptureScript([{ op: 'scroll', to: 100 }])).toMatch(/never captures/);
  });

  it('enforces the step and capture caps', () => {
    const tooManySteps: CaptureScriptStep[] = [
      ...Array.from({ length: SCRIPT_MAX_STEPS }, () => ({ op: 'scroll', to: 1 }) as CaptureScriptStep),
      cap(),
    ];
    expect(validateCaptureScript(tooManySteps)).toMatch(/Too many steps/);

    const tooManyCaptures = Array.from({ length: SCRIPT_MAX_CAPTURES + 1 }, (_, i) => cap(`s${i}`));
    expect(validateCaptureScript(tooManyCaptures)).toMatch(/Too many captures/);
  });

  it('rejects blank capture labels, naming the step', () => {
    expect(validateCaptureScript([{ op: 'capture', label: '  ' }])).toMatch(/Step 1: capture needs a non-empty label/);
  });

  it('rejects non-http(s) navigate targets up front', () => {
    const steps: CaptureScriptStep[] = [{ op: 'navigate', url: 'file:///C:/secrets.txt' }, cap()];
    expect(validateCaptureScript(steps)).toMatch(/Step 1: Only http\(s\) pages/);
  });
});

describe('scriptedStillDescription', () => {
  it('leads with the label, then title and url', () => {
    expect(scriptedStillDescription('pricing, annual on', 'Acme — Pricing', 'https://acme.io/pricing')).toBe(
      'pricing, annual on — Acme — Pricing (https://acme.io/pricing)',
    );
  });

  it('omits an empty title', () => {
    expect(scriptedStillDescription('menu open', '  ', 'https://acme.io')).toBe('menu open (https://acme.io)');
  });
});
