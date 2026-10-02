import { describe, expect, it } from 'vitest';
import { shouldShowCrashReportingPrompt } from './crash-reporting-prompt';

describe('shouldShowCrashReportingPrompt', () => {
  it('shows on a DSN build the user has not answered yet', () => {
    expect(shouldShowCrashReportingPrompt({ available: true, prompted: false, enabled: false })).toBe(true);
  });

  it('never shows when the build has no DSN (source builds, dev without the var)', () => {
    expect(shouldShowCrashReportingPrompt({ available: false, prompted: false, enabled: false })).toBe(false);
  });

  it('never shows again once answered, whichever way', () => {
    expect(shouldShowCrashReportingPrompt({ available: true, prompted: true, enabled: false })).toBe(false);
    expect(shouldShowCrashReportingPrompt({ available: true, prompted: true, enabled: true })).toBe(false);
  });

  it('never asks a user who already opted in through Settings before the prompt existed', () => {
    expect(shouldShowCrashReportingPrompt({ available: true, prompted: false, enabled: true })).toBe(false);
  });
});
