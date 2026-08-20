// The Creator library's "Studio" section (SHOT_QUALITY_DESIGN.md Q2): a live
// view of every Studio project's shot folders, grouped by project. Opening a
// version loads it into the Creator editor like any library version; saving
// appends v(n+1) into the shot's own folder (append-only — useMotionProject
// enforces it), where Studio's version picker finds it on its next scan.
//
// Deliberately read-only beyond open: no rename/delete/drag — the shot folder
// name IS the Studio registry id, and Studio owns that contract. Refreshes on
// mount and window focus (the no-watcher precedent).

import { useEffect, useState } from 'react';
import type { StudioShotLibraryProjectIpc } from '../../../shared/ipc/types';
import { ChevronIcon, TsxIcon, ProjectIcon } from '@shared/components/library-icons';

interface StudioShotsSectionProps {
  onLoadVersion: (filePath: string, folderPath: string) => void;
  /** The folder open in the editor — highlights the matching shot row. */
  activeFolderPath?: string | undefined;
}

export function StudioShotsSection({ onLoadVersion, activeFolderPath }: StudioShotsSectionProps) {
  const [projects, setProjects] = useState<StudioShotLibraryProjectIpc[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set());

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      void window.api.studioShotLibrary().then((res) => {
        if (!disposed && res.success && res.projects) setProjects(res.projects);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  if (projects.length === 0) return null;

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
        <span className="text-[10px] text-text-dim uppercase tracking-wider">Studio</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.projectId);
        return (
          <div
            key={project.projectId}
            className="rounded-[6px] overflow-hidden bg-app-base"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-app-hover text-text-secondary">
              <button
                onClick={() => toggle(setExpandedProjects, project.projectId)}
                className="shrink-0 cursor-pointer"
              >
                <ChevronIcon open={isExpanded} />
              </button>
              <span className="shrink-0 text-text-dim">
                <ProjectIcon />
              </span>
              <span
                className="text-[12px] font-medium truncate flex-1 cursor-pointer"
                onClick={() => toggle(setExpandedProjects, project.projectId)}
              >
                {project.projectName}
              </span>
              <span className="text-[10px] text-text-dim shrink-0">{project.shots.length}</span>
            </div>

            {isExpanded && (
              <div className="flex flex-col" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                {project.shots.map((shot) => {
                  const newest = shot.versions[shot.versions.length - 1];
                  const shotKey = shot.folderPath;
                  const shotExpanded = expandedShots.has(shotKey);
                  const isActive = activeFolderPath === shot.folderPath;
                  return (
                    <div key={shotKey}>
                      <div
                        className={`flex items-center gap-1 pl-4 pr-2 py-1 transition-colors cursor-pointer hover:bg-app-hover ${
                          isActive ? 'text-accent-light' : 'text-text-muted'
                        }`}
                        onClick={() => {
                          if (newest) onLoadVersion(newest, shot.folderPath);
                          toggle(setExpandedShots, shotKey);
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(setExpandedShots, shotKey);
                          }}
                          className="shrink-0 cursor-pointer"
                        >
                          <ChevronIcon open={shotExpanded} />
                        </button>
                        <span className="shrink-0 text-text-dim">
                          <TsxIcon />
                        </span>
                        <span className="text-[12px] truncate flex-1">{shot.name}</span>
                        <span className="text-[9px] text-text-dim shrink-0">
                          {newest ? (/v(\d+)\.tsx$/.exec(newest)?.[0]?.replace('.tsx', '') ?? '') : ''}
                        </span>
                      </div>
                      {shotExpanded &&
                        shot.versions.map((versionPath) => {
                          const fileName = versionPath.split(/[/\\]/).pop() ?? versionPath;
                          return (
                            <div
                              key={versionPath}
                              className="flex items-center gap-1 pl-9 pr-2 py-1 text-[11px] text-text-muted transition-colors cursor-pointer hover:bg-app-hover"
                              onClick={() => onLoadVersion(versionPath, shot.folderPath)}
                            >
                              <span className="shrink-0 text-text-dim">
                                <TsxIcon />
                              </span>
                              {fileName}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
