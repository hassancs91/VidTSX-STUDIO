import { useCallback, useEffect, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useOpenProject } from '@renderer/contexts/OpenProjectContext';
import { usePendingTransitionPackage } from '../hooks/useTransitionImport';
import { ProjectBrowser } from './ProjectBrowser';
import { EditorShell } from './EditorShell';
import { ImportTransitionsDialog } from './ImportTransitionsDialog';

function StudioComingSoon() {
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Studio</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <span className="text-text-dim">
          <Clapperboard size={40} strokeWidth={1.25} />
        </span>
        <div className="text-[15px] font-medium text-text-secondary">Studio — Coming soon</div>
        <div className="text-[12px] text-text-dim max-w-[380px]">
          A full professional AI-powered video editor. Auto-cut your footage
          with an AI editing agent, add TSX motion graphics, captions, SFX and
          generated visuals — longs and shorts, horizontal and vertical. Under
          active development.
        </div>
      </div>
    </div>
  );
}

export function StudioScreen() {
  // `studio-editor` is on since the 2026-09-10 flip; the Coming Soon screen
  // stays as the flag's off branch (a kill switch, never dead code to delete).
  if (!isFeatureEnabled('studio-editor')) {
    return <StudioComingSoon />;
  }
  return <StudioScreenInner />;
}

function StudioScreenInner() {
  // The open project is app-wide state, not screen-local: the Assets screen
  // reads it so AI organize can skip assets this session references
  // (ASSET_LIBRARY_DESIGN.md L7 Rev 2). Screens stay mounted when the user
  // navigates away, so a project stays genuinely open while they curate.
  const { openProjectId, setOpenProjectId } = useOpenProject();
  const [newProjectToken, setNewProjectToken] = useState(0);
  // A double-clicked transition package lands here, over the browser or the
  // editor alike — installing one is library-wide, not per project.
  const [transitionPackage, setTransitionPackage] = usePendingTransitionPackage();

  // W6: Home opens a project card straight into its editor, or asks for the
  // New Project dialog. `vidtsx:studio-open` follows the `vidtsx:creator-open`
  // precedent — the caller navigates first, then dispatches this once the
  // screen is mounted; the detail carries a project id OR `newProject`.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string; newProject?: boolean }>).detail;
      if (detail?.projectId) {
        setOpenProjectId(detail.projectId);
      } else if (detail?.newProject) {
        setOpenProjectId(null);
        setNewProjectToken((n) => n + 1);
      }
    };
    window.addEventListener('vidtsx:studio-open', handler);
    return () => window.removeEventListener('vidtsx:studio-open', handler);
  }, [setOpenProjectId]);

  const clearNewProject = useCallback(() => setNewProjectToken(0), []);

  return (
    <>
      {openProjectId ? (
        <EditorShell projectId={openProjectId} onBack={() => setOpenProjectId(null)} />
      ) : (
        <ProjectBrowser
          onOpen={setOpenProjectId}
          newProjectToken={newProjectToken}
          onNewProjectShown={clearNewProject}
        />
      )}
      {transitionPackage && (
        <ImportTransitionsDialog filePath={transitionPackage} onClose={() => setTransitionPackage(null)} />
      )}
    </>
  );
}
