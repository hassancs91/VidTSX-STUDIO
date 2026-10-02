// First-launch crash-reporting consent (docs/v1-go-live-runbook.md, decision D3).
// The renderer decides whether to show the one-time prompt from the settings it
// already reads; this is the whole rule, kept pure so it can be tested.

export interface CrashReportingPromptState {
  /** The build carries a DSN (`VITE_SENTRY_DSN`); without one nothing can be sent. */
  available: boolean;
  /** The user already answered the prompt, or touched the Settings toggle. */
  prompted: boolean;
  /** Reporting is already on (a user who enabled it before this prompt existed). */
  enabled: boolean;
}

/** Show the prompt only in a DSN build, only until answered, and never over an
 *  existing opt-in. */
export function shouldShowCrashReportingPrompt(state: CrashReportingPromptState): boolean {
  return state.available && !state.prompted && !state.enabled;
}
