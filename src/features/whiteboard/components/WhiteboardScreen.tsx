import { useWhiteboardProject } from '../hooks/useWhiteboardProject';
import { WhiteboardLibrary } from './WhiteboardLibrary';
import { WhiteboardEditor } from './WhiteboardEditor';

export function WhiteboardScreen() {
  const {
    status,
    projects,
    currentProject,
    error,
    createProject,
    openProject,
    removeProject,
    closeProject,
    renameProject,
    updateScene,
  } = useWhiteboardProject();

  if (status === 'ready' && currentProject) {
    return (
      <WhiteboardEditor
        project={currentProject}
        onBack={closeProject}
        onRename={renameProject}
        onUpdateScene={updateScene}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Whiteboard</span>
        {error && <span className="text-[11px] text-accent-red">{error}</span>}
      </div>
      <div className="flex-1 min-h-0">
        {status === 'loading' ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading…
          </div>
        ) : (
          <WhiteboardLibrary
            projects={projects}
            onCreate={createProject}
            onOpen={openProject}
            onDelete={removeProject}
          />
        )}
      </div>
    </div>
  );
}
