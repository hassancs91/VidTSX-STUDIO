// The job engine as callers in main wait on it (P3 parts 4-5): agents' tools,
// flows and Studio shots start `build` jobs through startBuildAndWait() on the
// engine this returns. It is imported lazily (it pulls in the whole builder),
// and tests swap in a fake (tools/test-build-engine.ts) through the seam.

import type { BuildJobEngine } from './build-and-wait';

let engineForTests: BuildJobEngine | null = null;

/** Test seam: a fake engine; null restores the app's. */
export function setBuildEngineForTests(engine: BuildJobEngine | null): void {
  engineForTests = engine;
}

export async function getBuildEngine(): Promise<BuildJobEngine> {
  if (engineForTests) return engineForTests;
  const { tsxJobEngine } = await import('./tsx-job-engine');
  return tsxJobEngine;
}
