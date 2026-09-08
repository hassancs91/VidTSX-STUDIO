// Resolving the artifacts a pending question's candidates name (agents plan
// §1.3, §7).
//
// Interaction cards are plain components with no IPC of their own — the same
// rule the viewers follow — so this is the one place that asks, and it is what
// turns `PickCard`'s compare mode on: a pick between two images shows the two
// images, a pick between two documents shows their titles.
//
// Only kinds that HAVE a picture are resolved. A document candidate needs no
// round trip, and resolving one would fetch its whole markdown body to show a
// label the payload already carries.

import { useEffect, useState } from 'react';
import type { AgentArtifact, InteractionRequest } from '@shared/types/agents';
import type { InteractionPreview } from '@renderer/components/interactions/registry';

/** Artifact kinds whose resolve returns something worth showing in a card. */
const PICTURED = new Set<string>(['image-set', 'video']);

function candidateArtifactIds(request: InteractionRequest | null): string[] {
  if (!request) return [];
  const { payload } = request;
  const candidates =
    payload.kind === 'pick' ? payload.candidates : payload.kind === 'approve' ? payload.items : [];
  return candidates.map((c) => c.artifactId).filter((id): id is string => Boolean(id));
}

export function useInteractionPreviews(
  agentId: string,
  sessionId: string | null,
  request: InteractionRequest | null,
  artifacts: AgentArtifact[],
): Record<string, InteractionPreview> {
  const [previews, setPreviews] = useState<Record<string, InteractionPreview>>({});
  const ids = candidateArtifactIds(request);
  const key = ids.join(',');

  useEffect(() => {
    if (!sessionId || ids.length === 0) {
      setPreviews({});
      return;
    }
    let disposed = false;
    const named = ids
      .map((id) => artifacts.find((a) => a.id === id))
      .filter((a): a is AgentArtifact => a !== undefined);

    // The titles are known without asking; the urls are not, so the card gets
    // its labels immediately and its pictures a moment later.
    const base: Record<string, InteractionPreview> = {};
    for (const artifact of named) base[artifact.id] = { kind: artifact.kind, title: artifact.title };
    setPreviews(base);

    void Promise.all(
      named
        .filter((a) => PICTURED.has(a.kind))
        .map(async (artifact) => {
          const result = await window.api.agentArtifactResolve({
            agentId,
            sessionId,
            artifactId: artifact.id,
          });
          const url = result.success ? result.assetUrls?.[0] : undefined;
          return url ? ([artifact.id, url] as const) : null;
        }),
    ).then((pairs) => {
      if (disposed) return;
      setPreviews((current) => {
        const next = { ...current };
        for (const pair of pairs) {
          if (!pair) continue;
          const [id, imageUrl] = pair;
          const preview = next[id];
          if (preview) next[id] = { ...preview, imageUrl };
        }
        return next;
      });
    });

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, sessionId, key, artifacts.length]);

  return previews;
}
