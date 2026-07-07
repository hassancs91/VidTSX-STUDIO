import { useState } from 'react';
import type { StudioProjectData } from '../types';
import { useModuleServerUrl, assetUrl } from '../hooks/useModuleServerUrl';

interface ProjectListProps {
  projects: StudioProjectData[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function hasCaptions(captions: StudioProjectData['captions']): boolean {
  return !!captions && Array.isArray(captions.segments) && captions.segments.length > 0;
}

// Human-readable summary of what the project contains. Replaces the old
// hardcoded "Empty" — that only stays when the project genuinely has nothing.
function describeContents(project: StudioProjectData): string {
  const parts: string[] = [];
  const clipCount = project.videoClips?.filter((c) => !c.hidden).length ?? 0;
  if (clipCount > 0 || project.videoPath) parts.push('Video');
  if ((project.tsxSlots?.length ?? 0) > 0) parts.push('TSX');
  if (hasCaptions(project.captions)) parts.push('Captions');
  return parts.length > 0 ? parts.join(' · ') : 'Empty';
}

// First on-disk video frame we can show as a poster. Prefers the first visible
// clip on the timeline; falls back to the legacy project-level video.
function getThumbnailSource(
  project: StudioProjectData
): { filePath: string; offset: number } | null {
  const clip = project.videoClips?.find((c) => !c.hidden && c.filePath);
  if (clip) {
    return { filePath: clip.filePath, offset: Math.max(0.1, clip.inPointSeconds ?? 0) };
  }
  if (project.videoPath) {
    return { filePath: project.videoPath, offset: 1 };
  }
  return null;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PlaceholderThumb() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-ghost"
    >
      <rect x="6" y="10" width="36" height="28" rx="3" />
      <path d="M20 20V28L27 24L20 20Z" fill="currentColor" />
    </svg>
  );
}

export function ProjectList({ projects, onOpen, onDelete, onCreate }: ProjectListProps) {
  const serverUrl = useModuleServerUrl();

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-[16px]">
        <svg
          width={48}
          height={48}
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-ghost"
        >
          <rect x="6" y="10" width="36" height="28" rx="3" />
          <path d="M20 20V28L27 24L20 20Z" fill="currentColor" />
        </svg>
        <span className="text-text-dim text-[13px]">Create your first project</span>
        <button
          onClick={onCreate}
          className="flex items-center gap-[6px] px-[16px] h-[32px] rounded-[6px] text-[12px] font-medium text-white transition-colors"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          New Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-[16px]">
      <div className="grid gap-[12px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            serverUrl={serverUrl}
            onOpen={() => onOpen(project.id)}
            onDelete={() => onDelete(project.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectThumbnail({
  project,
  serverUrl,
}: {
  project: StudioProjectData;
  serverUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const source = getThumbnailSource(project);
  const base = source ? assetUrl(serverUrl, source.filePath) : null;
  const url = base && source ? `${base}#t=${source.offset}` : null;

  return (
    <div
      className="w-full rounded-[6px] overflow-hidden flex items-center justify-center"
      style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--color-app-bg)' }}
    >
      {url && !failed ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onError={() => setFailed(true)}
          onLoadedMetadata={(e) => {
            // Force a frame to paint even when the #t= fragment is ignored.
            const v = e.currentTarget;
            if (source && v.currentTime < source.offset) {
              try {
                v.currentTime = source.offset;
              } catch {
                /* seek not ready — the fragment frame stays */
              }
            }
          }}
          className="w-full h-full"
          style={{ objectFit: 'contain', pointerEvents: 'none' }}
        />
      ) : (
        <PlaceholderThumb />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  serverUrl,
  onOpen,
  onDelete,
}: {
  project: StudioProjectData;
  serverUrl: string | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const duration = project.metadata?.durationInSeconds ?? project.composition.durationInSeconds;
  const width = project.metadata?.width ?? project.composition.width;
  const height = project.metadata?.height ?? project.composition.height;

  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-[8px] p-[12px] rounded-[8px] text-left transition-colors group"
      style={{
        backgroundColor: 'var(--color-app-surface)',
        border: '0.5px solid var(--color-border)',
      }}
    >
      <ProjectThumbnail project={project} serverUrl={serverUrl} />

      {/* Title + delete */}
      <div className="flex items-center justify-between w-full">
        <span className="text-text-primary text-[12px] font-medium truncate">
          {project.name}
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-ghost hover:text-status-error text-[10px] px-[4px] py-[2px] rounded transition-all cursor-pointer"
        >
          Delete
        </span>
      </div>

      {/* Duration · dimensions · contents */}
      <div className="flex items-center gap-[6px] flex-wrap">
        <span className="text-text-dim text-[10px]">{formatDuration(duration)}</span>
        <span className="text-text-ghost text-[10px]">&middot;</span>
        <span className="text-text-dim text-[10px]">{width}x{height}</span>
        <span className="text-text-ghost text-[10px]">&middot;</span>
        <span className="text-text-dim text-[10px]">{describeContents(project)}</span>
      </div>

      <span className="text-text-ghost text-[10px]">
        {formatDate(project.updatedAt)}
      </span>
    </button>
  );
}
