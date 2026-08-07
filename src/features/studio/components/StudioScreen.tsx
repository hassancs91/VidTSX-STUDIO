import { useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { ProjectBrowser } from './ProjectBrowser';
import { EditorShell } from './EditorShell';

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
  if (!isFeatureEnabled('studio-editor')) {
    return <StudioComingSoon />;
  }
  return <StudioScreenInner />;
}

function StudioScreenInner() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  if (activeProjectId) {
    return (
      <EditorShell projectId={activeProjectId} onBack={() => setActiveProjectId(null)} />
    );
  }
  return <ProjectBrowser onOpen={setActiveProjectId} />;
}
