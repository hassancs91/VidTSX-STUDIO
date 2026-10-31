// THE GATED LIVE TEST (DECISION_MODELS_DESIGN.md §15.1) — SKIPPED unless VIDTSX_DECISIONS_LIVE=1. DEFERRED-HASAN for builders: the
// verifier runs it through the kit launcher D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\live-test.sh, which loads the two keys into
// JEV_API_KEY / OPENROUTER_API_KEY without printing them. This file reads them from process.env ONLY, never prints or logs them, and
// refuses a provider whose key is unset (that provider's test fails; the other still runs).
//
// What it sends: D1's T2 + T3 sets framed by the built-ins (D-r16), packed ONE request per task per provider as D1 packed them — at most
// 4 HTTP requests in all (a hard cap: a 5th never reaches the network) — through main's registration, the real engine, the System One
// adapter and the real `fetch`. The bar (§15.1): accuracy ≥ 38 / 40 on each set, Brier ≤ 0.05, 0 off-list, 0 errors, per-request latency
// ≤ 2,000 ms (Jev) / ≤ 4,000 ms (MSD1, its first call — T2, sent first — excluded: one request per set makes "p95" the request itself).
// Writes a small result JSON (numbers, the served model and error codes only) to $VIDTSX_DECISIONS_LIVE_OUT, else the OS temp dir.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { HostedDecisionProviderId } from '../../../../shared/types/decisions';
import { createRequestCap, isLiveBenchmarkEnabled, LIVE_KEY_ENV, LIVE_MAX_REQUESTS, runLiveBenchmark, type LiveProviderResult } from './live-run';
import { liveBarViolations, liveResultJson } from './live-bar';

const enabled = isLiveBenchmarkEnabled(process.env);

describe.skipIf(!enabled)('the gated live test — Jev + MSD1 on T2 + T3 through the product path (§15.1)', () => {
  const cap = createRequestCap((url, init) => globalThis.fetch(url, init), LIVE_MAX_REQUESTS);
  const results: LiveProviderResult[] = [];

  afterAll(() => {
    const out = process.env.VIDTSX_DECISIONS_LIVE_OUT || join(tmpdir(), `vidtsx-decisions-live-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, liveResultJson(results, { requests: cap.count() }));
    // the path only — the file holds numbers, the served model and error codes; never a key or the state
    console.log(`decisions live result: ${out} (${cap.count()} request(s))`);
  });

  const providers: HostedDecisionProviderId[] = ['jev', 'openrouter-decisions'];
  it.each(providers)(
    '%s: ≥ 38 / 40 on T2 and T3, Brier ≤ 0.05, 0 off-list, 0 errors, latency within its bound',
    async (provider) => {
      let result: LiveProviderResult;
      try {
        result = await runLiveBenchmark({ provider, apiKey: process.env[LIVE_KEY_ENV[provider]], fetch: cap.fetch });
      } catch (err) {
        results.push({ provider, refused: true, tasks: [] });
        throw err;
      }
      results.push(result);
      expect(liveBarViolations([result])).toEqual([]);
      expect(cap.count()).toBeLessThanOrEqual(LIVE_MAX_REQUESTS);
    },
    60_000,
  );
});
