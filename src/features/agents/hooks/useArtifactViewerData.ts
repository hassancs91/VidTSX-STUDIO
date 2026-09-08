// Resolving the selected artifact into what its viewer needs (agents plan
// §1.5). Viewers are plain components with no IPC of their own, so this is the
// one place that asks — and it re-asks whenever the artifact CHANGES, which is
// what makes `edit_composition` show its new version rather than the old one.

import { useEffect, useState } from 'react';
import type { AgentArtifact } from '@shared/types/agents';
import type { ResolvedArtifact } from '@renderer/components/artifact-viewers/registry';

export function useArtifactViewerData(
  agentId: string,
  sessionId: string | null,
  artifact: AgentArtifact | null,
) {
  const [resolved, setResolved] = useState<ResolvedArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // A job's payload changes on every progress tick and carries nothing to
  // resolve, so it is keyed out of the dependency — otherwise a running render
  // would re-resolve several times a second.
  const key =
    artifact && artifact.kind !== 'job'
      ? `${artifact.id}:${artifact.version ?? 1}:${JSON.stringify(artifact.payload)}`
      : (artifact?.id ?? '');

  useEffect(() => {
    if (!artifact || !sessionId || artifact.kind === 'job') {
      setResolved(null);
      setError(undefined);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(undefined);
    void window.api
      .agentArtifactResolve({ agentId, sessionId, artifactId: artifact.id })
      .then((result) => {
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
  }, [agentId, sessionId, key]);

  return { resolved, loading, error };
}
