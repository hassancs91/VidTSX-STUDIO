// The viewer registry, keyed by artifact kind (agents plan §1.3).
//
// One entry per kind, and only ever GROWS — decision 4: registries do not
// shrink, so an agent installed against an older app keeps rendering. Wave 2
// (§13) adds `html-page`, `slides`, `table`, `model-3d`, `frame-strip` and
// `character-bible` here and nowhere else; `audio` arrived with W2b.
//
// Shared with Flows (docs/flows-plan.md 1.8): the agents feature imports this
// module rather than owning it.

import type { ArtifactKind } from '../../../shared/types/agents';
import type { ArtifactViewer, ArtifactViewerRegistry } from './types';
import { CompositionViewer } from './CompositionViewer';
import { DocumentViewer } from './DocumentViewer';
import { ImageSetViewer } from './ImageSetViewer';
import { JobViewer } from './JobViewer';
import { VideoViewer } from './VideoViewer';
import { AudioViewer } from './AudioViewer';

const VIEWERS: ArtifactViewerRegistry = {
  document: DocumentViewer,
  composition: CompositionViewer,
  video: VideoViewer,
  'image-set': ImageSetViewer,
  job: JobViewer,
  audio: AudioViewer,
};

export function getArtifactViewer(kind: ArtifactKind): ArtifactViewer {
  return VIEWERS[kind];
}

export function listArtifactViewerKinds(): ArtifactKind[] {
  return Object.keys(VIEWERS) as ArtifactKind[];
}

export type { ArtifactViewerProps, ResolvedArtifact, ArtifactLiveState } from './types';
