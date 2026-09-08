// The handoffs available for the artifact on the stage (agents plan §1.4).
//
// Which actions appear is a function of KIND, in one table, because the answer
// has to be the same everywhere: a video cannot be opened in the Creator, and a
// job has no file to open a folder on until it is terminal.

import { Copy, FolderOpen, ListVideo, Save, Scissors, Wand2 } from 'lucide-react';
import type { AgentArtifactActionKind } from '@shared/ipc/types';
import type { AgentArtifact, ArtifactKind } from '@shared/types/agents';

const ACTIONS: Record<AgentArtifactActionKind, { label: string; icon: typeof Save }> = {
  'save-to-library': { label: 'Save to Library', icon: Save },
  'open-in-creator': { label: 'Open in TSX', icon: Wand2 },
  'open-in-studio': { label: 'Add to Studio', icon: Scissors },
  'send-to-queue': { label: 'Render', icon: ListVideo },
  'open-folder': { label: 'Open folder', icon: FolderOpen },
  'copy-path': { label: 'Copy path', icon: Copy },
};

const BY_KIND: Record<ArtifactKind, AgentArtifactActionKind[]> = {
  document: ['save-to-library', 'open-folder', 'copy-path'],
  composition: ['send-to-queue', 'open-in-creator', 'open-in-studio', 'save-to-library', 'copy-path'],
  video: ['open-folder', 'copy-path'],
  'image-set': ['open-folder', 'copy-path'],
  job: [],
};

interface Props {
  artifact: AgentArtifact;
  running: AgentArtifactActionKind | null;
  /** False disables "Add to Studio" — a shot needs an open Studio project. */
  studioProjectOpen: boolean;
  onRun: (action: AgentArtifactActionKind) => void;
}

export function ActionBar({ artifact, running, studioProjectOpen, onRun }: Props) {
  // A job's own actions belong to its RESULT, which arrives as a separate
  // artifact — so a job row offers nothing here rather than offering something
  // that would read a payload field it does not have yet (§1.4).
  const actions = BY_KIND[artifact.kind];
  if (actions.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 h-[36px] shrink-0 overflow-x-auto bg-app-surface"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] text-text-dim truncate shrink-0 mr-1 max-w-[180px]">
        {artifact.title}
      </span>
      {actions.map((action) => {
        const { label, icon: Icon } = ACTIONS[action];
        const blocked = action === 'open-in-studio' && !studioProjectOpen;
        return (
          <button
            key={action}
            onClick={() => onRun(action)}
            disabled={running !== null || blocked}
            title={blocked ? 'Open a Studio project first' : label}
            className="flex items-center gap-1 shrink-0 whitespace-nowrap rounded-[6px] px-2 py-1 text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            <Icon size={11} strokeWidth={1.75} />
            {running === action ? 'Working…' : label}
          </button>
        );
      })}
    </div>
  );
}
