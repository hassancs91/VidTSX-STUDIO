import { getValue, setValue } from '../settings-db';
import type { LibraryPrefs } from '../../../shared/types/asset-library';

/**
 * Small app-level preferences the library owns (ASSET_LIBRARY_DESIGN.md L2):
 * the one-time AI-describe consent, whether the no-provider note has been
 * dismissed, and the auto-describe-on-import default.
 *
 * Read straight from the settings KV store rather than through a typed
 * getter in settings.ts — same reason as library-paths.ts: that file is
 * owned by a parallel workstream right now. Fold typed accessors in when
 * it settles.
 */

const CONSENT_KEY = 'libraryDescribeConsentAt';
const NOTE_DISMISSED_KEY = 'libraryDescribeNoteDismissed';
const AUTO_DESCRIBE_KEY = 'libraryAutoDescribeOnImport';

export function getLibraryPrefs(): LibraryPrefs {
  return {
    describeConsentAt: getValue<string>(CONSENT_KEY),
    noProviderNoteDismissed: getValue<boolean>(NOTE_DISMISSED_KEY) ?? false,
    // L2: ON for library imports by default — a logo deserves a caption.
    autoDescribeOnImport: getValue<boolean>(AUTO_DESCRIBE_KEY) ?? true,
  };
}

/** Record the one-time consent. Idempotent — the first grant keeps its date. */
export function grantDescribeConsent(nowIso: string): void {
  if (getValue<string>(CONSENT_KEY)) return;
  setValue(CONSENT_KEY, nowIso);
}

export function setNoProviderNoteDismissed(dismissed: boolean): void {
  setValue(NOTE_DISMISSED_KEY, dismissed);
}

export function setAutoDescribeOnImport(enabled: boolean): void {
  setValue(AUTO_DESCRIBE_KEY, enabled);
}

export function hasDescribeConsent(): boolean {
  return Boolean(getValue<string>(CONSENT_KEY));
}
