// The right pane (agents plan §1.7): the latest artifact large in its viewer, a
// filmstrip of the earlier ones, and the action bar for whatever is selected.
//
// The viewer is looked up in the SHARED registry rather than switched on here,
// which is what makes a wave-2 artifact kind one registry entry and no change
// to this file (decision 2).

import { Sparkles } from 'lucide-react';
import type { AgentArtifact } from '@shared/types/agents';
import type { AgentArtifactActionKind } from '@shared/ipc/types';
import {
  getArtifactViewer,
  type ArtifactLiveState,
  type ResolvedArtifact,
} from '@renderer/components/artifact-viewers/registry';
import { ActionBar } from '@renderer/components/artifact-viewers/ActionBar';
import { Filmstrip } from './Filmstrip';

interface Props {
  artifacts: AgentArtifact[];
  selected: AgentArtifact | null;
  resolved: ResolvedArtifact | null;
  resolving: boolean;
  resolveError?: string;
  live?: ArtifactLiveState;
  actionRunning: AgentArtifactActionKind | null;
  studioProjectOpen: boolean;
  onSelect: (artifactId: string) => void;
  onAction: (action: AgentArtifactActionKind) => void;
  /** A pending question renders INSIDE the stage, over the viewer (§1.7). */
  interactionCard?: React.ReactNode;
}

export function ArtifactStage({
  artifacts,
  selected,
  resolved,
  resolving,
  resolveError,
  live,
  actionRunning,
  studioProjectOpen,
  onSelect,
  onAction,
  interactionCard,
}: Props) {
  const Viewer = selected ? getArtifactViewer(selected.kind) : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-app-player">
      <div className="flex-1 min-h-0 relative">
        {selected && Viewer ? (
          <Viewer
            artifact={selected}
            resolved={resolved}
            loading={resolving}
            {...(resolveError !== undefined ? { error: resolveError } : {})}
            {...(live ? { live } : {})}
          />
        ) : (
          <StageEmpty />
        )}
        {interactionCard ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-app-player/90 p-4">
            {interactionCard}
          </div>
        ) : null}
      </div>

      {selected ? (
        <ActionBar
          artifact={selected}
          running={actionRunning}
          studioProjectOpen={studioProjectOpen}
          onRun={onAction}
          extra={['freeze-to-flow']}
        />
      ) : null}

      <Filmstrip artifacts={artifacts} selectedId={selected?.id ?? null} onSelect={onSelect} />
    </div>
  );
}

function StageEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center px-6">
      <Sparkles size={48} strokeWidth={1} className="text-text-ghost" />
      <div className="text-[14px] text-text-muted">Nothing made yet</div>
      <div className="text-[12px] text-text-dim max-w-[320px] leading-snug">
        Documents, compositions, images and finished videos appear here as the agent produces them.
      </div>
    </div>
  );
}
