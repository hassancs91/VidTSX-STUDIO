// ─── Content Safety types ───
// Status surface for the AI → Content Safety page. Counters are local-only
// (settings KV, never telemetry); the gate itself has no toggles by design.

export interface ContentSafetyStatusResponse {
  /** Lifetime local counts of blocked events, per gate. */
  blockedCounts: {
    prompt: number;
    image: number;
  };
  /** Curated blocklist size (Gate A). */
  promptTermCount: number;
  classifier: {
    /** The bundled model file is present and passes its integrity hash. */
    present: boolean;
    /** Warm session loaded in the worker (loads lazily on first check). */
    loaded: boolean;
    file: string | null;
    sha256: string | null;
  };
  /** Dev bypass is active (dev builds only — always false in a release build). */
  devBypass: boolean;
}
