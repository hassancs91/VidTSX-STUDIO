// Everything the session has made so far, along the bottom of the stage
// (agents plan §1.7). Oldest first, so the strip reads as the run's history.

import { FileText, Film, Globe, Image as ImageIcon, ListVideo, Music, Play } from 'lucide-react';
import type { AgentArtifact, ArtifactKind } from '@shared/types/agents';

const KIND_ICON: Record<ArtifactKind, typeof FileText> = {
  document: FileText,
  composition: Play,
  video: Film,
  'image-set': ImageIcon,
  job: ListVideo,
  audio: Music,
  'web-page': Globe,
};

interface Props {
  artifacts: AgentArtifact[];
  selectedId: string | null;
  onSelect: (artifactId: string) => void;
}

export function Filmstrip({ artifacts, selectedId, onSelect }: Props) {
  if (artifacts.length === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5 px-2 h-[56px] shrink-0 overflow-x-auto bg-app-deep"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      {artifacts.map((artifact) => {
        const Icon = KIND_ICON[artifact.kind];
        const selected = artifact.id === selectedId;
        return (
          <button
            key={artifact.id}
            onClick={() => onSelect(artifact.id)}
            title={`${artifact.title} (${artifact.id})`}
            className={`flex flex-col items-center justify-center gap-1 w-[64px] h-[42px] shrink-0 rounded-[6px] ${
              selected ? 'bg-app-active' : 'bg-app-surface hover:bg-app-hover'
            }`}
            style={{
              border: `0.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            <Icon
              size={13}
              strokeWidth={1.5}
              className={selected ? 'text-accent-light' : 'text-text-muted'}
            />
            <span
              className={`w-full px-1 truncate text-[9px] ${
                selected ? 'text-accent-light' : 'text-text-dim'
              }`}
            >
              {artifact.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
