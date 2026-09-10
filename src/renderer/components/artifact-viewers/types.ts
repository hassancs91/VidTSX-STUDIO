// Artifact viewers — the shared contract (agents plan §1.3).
//
// These live under `src/renderer/components/` rather than inside the agents
// feature because Flows consumes the same registry for its run outputs
// (docs/flows-plan.md 1.8). So a viewer is a PLAIN component: typed props, no
// IPC of its own, no knowledge of sessions. Whoever hosts it resolves the
// artifact first and hands the result down.

import type { ComponentType } from 'react';
import type { AgentArtifact, ArtifactKind } from '../../../shared/types/agents';

/** What main gave back for this artifact (`AGENT_ARTIFACT_RESOLVE`). */
export interface ResolvedArtifact {
  /** `document`: the markdown body. `web-page`: the HTML with its media
   *  inlined as data URIs (W9). */
  text?: string;
  /** `composition`: a live module url, re-served if the store went cold. */
  moduleUrl?: string;
  /** `video` / `image-set`: one servable url per file, in payload order. */
  assetUrls?: string[];
}

/** Live state the STORE does not have — a queue row's progress, mainly. */
export interface ArtifactLiveState {
  progress?: number;
  statusText?: string;
  onCancel?: () => void;
}

export interface ArtifactViewerProps {
  artifact: AgentArtifact;
  resolved: ResolvedArtifact | null;
  loading?: boolean;
  error?: string;
  live?: ArtifactLiveState;
}

export type ArtifactViewer = ComponentType<ArtifactViewerProps>;

export type ArtifactViewerRegistry = Record<ArtifactKind, ArtifactViewer>;
