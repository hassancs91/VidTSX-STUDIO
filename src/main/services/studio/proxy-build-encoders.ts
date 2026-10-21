// Which encoder each asset's latest proxy build used in this session (A4).
// After the first-4K-import card's download, the proxies still on x264 — the
// clip that triggered the card included — are re-queued so they end on the
// GPU without a re-import. In memory on purpose: a proxy an earlier session
// built is left as it is (rebuilding a whole library is not this card's job).

import type { ProxyGpuEncoder } from './proxy-encoders';

export type ProxyBuildEncoder = 'x264' | ProxyGpuEncoder;

const encoders = new Map<string, ProxyBuildEncoder>();

const keyOf = (projectId: string, assetId: string): string => `${projectId}:${assetId}`;

/** Called by `generateProxy` once it has resolved the encoder for this build. */
export function recordProxyBuildEncoder(projectId: string, assetId: string, encoder: ProxyBuildEncoder): void {
  encoders.set(keyOf(projectId, assetId), encoder);
}

/** The encoder of this asset's latest build this session; undefined = none built yet. */
export function getProxyBuildEncoder(projectId: string, assetId: string): ProxyBuildEncoder | undefined {
  return encoders.get(keyOf(projectId, assetId));
}
