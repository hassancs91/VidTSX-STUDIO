import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, FolderCog, PackageOpen, Plus } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useProjectPosters } from '@renderer/hooks/useProjectPosters';
import { useStudioProjects } from '../hooks/useStudioProjects';
import { useBrandList } from '../hooks/useBrandList';
import { NewProjectDialog } from './NewProjectDialog';
import { ExportPackageDialog } from './ExportPackageDialog';
import { ImportPackageDialog } from './ImportPackageDialog';
import { ProjectCard } from './ProjectCard';

interface Props {
  onOpen: (projectId: string) => void;
  /** W6: bumps when Home asks for a new project — opens the dialog once;
   *  the browser remounts around every editor visit, so the request is
   *  acknowledged rather than re-read on each mount. */
  newProjectToken?: number;
  onNewProjectShown?: () => void;
}

export function ProjectBrowser({ onOpen, newProjectToken, onNewProjectShown }: Props) {
  const { status, projects, root, error, create, remove, refresh, changeRoot } = useStudioProjects();
  const [showNew, setShowNew] = useState(false);
  // W6: posters read like asset thumbnails; the placeholder paints with the
  // project brand's palette (the library IPC is the one crossing point).
  const { getPoster } = useProjectPosters(projects);
  const brands = useBrandList();
  const palettes = useMemo(() => new Map(brands.map((b) => [b.id, b.palette])), [brands]);

  useEffect(() => {
    if (!newProjectToken) return;
    setShowNew(true);
    onNewProjectShown?.();
  }, [newProjectToken, onNewProjectShown]);
  const [importPath, setImportPath] = useState<string | undefined>(undefined);
  const [showImport, setShowImport] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ id: string; name: string } | null>(null);

  // A double-clicked .vidtsx parks in main until the browser is on screen. The
  // push event only NAVIGATES here; the path is claimed on mount too, so a
  // launch straight into another screen still finds it.
  useEffect(() => {
    const claim = async (): Promise<void> => {
      const res = await window.api.studioPackagePending();
      if (res.filePath) {
        setImportPath(res.filePath);
        setShowImport(true);
      }
    };
    void claim();
    return window.api.onStudioPackageOpenFile(() => void claim());
  }, []);

  const openImport = (filePath?: string): void => {
    setImportPath(filePath);
    setShowImport(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Studio</span>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => void changeRoot()}
            title={`Projects folder: ${root}\nClick to change`}
            className="flex items-center gap-1.5 px-2 h-[24px] rounded-[6px] text-[11px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors max-w-[320px]"
          >
            <FolderCog size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{root || 'Projects folder'}</span>
          </button>
          <Button variant="secondary" size="sm" onClick={() => openImport(undefined)} data-import-package>
            <span className="flex items-center gap-1">
              <PackageOpen size={13} strokeWidth={1.75} />
              Import
            </span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
            <span className="flex items-center gap-1">
              <Plus size={13} strokeWidth={2} />
              New Project
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <ErrorBanner message={error} />}
        {status === 'loading' && (
          <div className="text-[12px] text-text-dim pt-8 text-center">Loading projects…</div>
        )}
        {status === 'ready' && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center pt-24 px-8">
            <span className="text-text-dim">
              <Clapperboard size={40} strokeWidth={1.25} />
            </span>
            <div className="text-[15px] font-medium text-text-secondary">No projects yet</div>
            <div className="text-[12px] text-text-dim max-w-[360px]">
              Create a project to start editing — landscape for longs, portrait for
              shorts. Media stays where it is; the project references it in place.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => setShowNew(true)}>
                Create your first project
              </Button>
              <Button variant="secondary" onClick={() => openImport(undefined)}>
                Import a package
              </Button>
            </div>
          </div>
        )}
        {projects.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                posterSrc={getPoster(project)}
                palette={(project.brandId && palettes.get(project.brandId)) || null}
                onOpen={() => onOpen(project.id)}
                onDelete={() => void remove(project.id)}
                onExport={() => setExportTarget({ id: project.id, name: project.name })}
              />
            ))}
          </div>
        )}
      </div>

      <ImportPackageDialog
        isOpen={showImport}
        filePath={importPath}
        onClose={() => {
          setShowImport(false);
          setImportPath(undefined);
          void refresh();
        }}
        onOpenProject={(projectId) => {
          setShowImport(false);
          setImportPath(undefined);
          onOpen(projectId);
        }}
      />

      {exportTarget && (
        <ExportPackageDialog
          isOpen
          projectId={exportTarget.id}
          projectName={exportTarget.name}
          onClose={() => setExportTarget(null)}
        />
      )}

      <NewProjectDialog
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onCreate={async (req) => {
          const id = await create(req);
          if (id) onOpen(id);
        }}
      />
    </div>
  );
}
