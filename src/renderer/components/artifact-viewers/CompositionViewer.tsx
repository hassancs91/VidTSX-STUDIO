// `composition` — the Remotion player, over the module server (§1.3).
//
// `IsolatedPreview` is reused exactly as the Creator uses it: it runs the user
// module in a separate webview so a bad composition cannot take the app down.
// The url comes from `AGENT_ARTIFACT_RESOLVE` rather than off the artifact,
// because the module store is in-memory and a reopened session's stored url
// points at nothing (§1.5). A builder version's files (`vN.assets/`) come
// back with it and reach the piece as its `assets` prop, as in the Creator.

import { useMemo } from 'react';
import { IsolatedPreview } from '@features/player';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

export function CompositionViewer({ artifact, resolved, loading, error }: ArtifactViewerProps) {
  const moduleUrl = resolved?.moduleUrl;
  const assets = resolved?.assets;
  const config = artifact.kind === 'composition' ? artifact.payload.config : null;
  const inputProps = useMemo(() => (assets ? { assets } : undefined), [assets]);
  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={Boolean(moduleUrl && config)}
      emptyLabel="This composition could not be prepared for preview."
    >
      {moduleUrl && config ? (
        <IsolatedPreview
          moduleUrl={moduleUrl}
          config={config}
          {...(inputProps ? { inputProps } : {})}
          className="h-full w-full"
        />
      ) : null}
    </ViewerFrame>
  );
}
