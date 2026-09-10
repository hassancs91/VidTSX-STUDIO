// Resolving a run artifact into what its shared viewer needs (flows plan
// §1.4, W8 Stage 2) — the flows twin of the agents' `useArtifactViewerData`,
// over the run-scoped `FLOWS_RUN_ARTIFACT_RESOLVE`. Viewers are plain
// components with no IPC of their own, so this is the one place that asks.

import { useEffect, useState } from 'react';
import type { AgentArtifact } from '@shared/types/agents';
import type { ResolvedArtifact } from '@renderer/components/artifact-viewers/registry';

export function useRunArtifactViewer(runId: string | null, artifact: AgentArtifact | null) {
  const [resolved, setResolved] = useState<ResolvedArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const key = artifact && artifact.kind !== 'job' ? `${artifact.id}:${artifact.version ?? 1}` : (artifact?.id ?? '');

  useEffect(() => {
    if (!artifact || !runId || artifact.kind === 'job') {
      setResolved(null);
      setError(undefined);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(undefined);
    void window.api.flowsRunArtifactResolve({ runId, artifactId: artifact.id }).then((result) => {
      if (disposed) return;
      if (result.success) {
        setResolved({
          ...(result.text !== undefined ? { text: result.text } : {}),
          ...(result.moduleUrl ? { moduleUrl: result.moduleUrl } : {}),
          ...(result.assetUrls ? { assetUrls: result.assetUrls } : {}),
        });
      } else {
        setResolved(null);
        setError(result.error ?? 'That artifact could not be opened.');
      }
      setLoading(false);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, key]);

  return { resolved, loading, error };
}
