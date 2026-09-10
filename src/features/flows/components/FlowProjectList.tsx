import { Workflow, Plus, Upload } from 'lucide-react';
import type { FlowProjectSummary } from '@shared/ipc/types';
import { FlowProjectCard } from './FlowProjectCard';
import type { FlowCardAction } from './FlowCardMenu';

interface Props {
  projects: FlowProjectSummary[];
  onCreate: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onAction: (id: string, action: FlowCardAction) => void;
}

type Group = 'mine' | 'builtin' | 'installed';

const GROUPS: { id: Group; label: string; empty: string }[] = [
  { id: 'mine', label: 'My flows', empty: 'Flows you create, duplicate, freeze or import appear here.' },
  { id: 'builtin', label: 'Built-in', empty: 'The flows that ship with the app arrive with Stage 6 of the flows plan.' },
  { id: 'installed', label: 'Installed', empty: 'Flows installed from a .vidtsxflow file or an agent package appear here.' },
];

/** Reads the `source` column (Stage 0). Built-in and installed rows are Stage 6's; until
 *  then every row is the user's, and a forward-compatible string keeps them grouped when they land. */
function groupFor(project: FlowProjectSummary): Group {
  const source: string = project.source;
  if (source === 'builtin' || project.id.startsWith('vidtsx/')) return 'builtin';
  if (source === 'installed') return 'installed';
  return 'mine';
}

const SECONDARY = 'inline-flex items-center gap-1.5 h-[26px] px-3 rounded-[6px] text-[11px] text-text-secondary hover:bg-app-hover';

export function FlowProjectList({ projects, onCreate, onImport, onOpen, onAction }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-text-muted">
        <Workflow size={48} strokeWidth={1} className="text-text-ghost" />
        <p className="mt-4 text-[14px] text-text-muted">No flows yet</p>
        <p className="mt-1 text-[12px] text-text-dim">Create a flow to chain prompts, images and generators visually.</p>
        <div className="mt-5 flex items-center gap-2">
          <button onClick={onCreate} className="inline-flex items-center gap-1.5 h-[26px] px-3 rounded-[6px] bg-accent text-white hover:opacity-90 text-[11px]">
            <Plus size={12} strokeWidth={2} />
            New Flow
          </button>
          <button onClick={onImport} className={SECONDARY} style={{ border: '0.5px solid var(--color-border-hover)' }} data-flow-import>
            <Upload size={12} strokeWidth={2} />
            Import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[13px] font-medium text-text-secondary">Flows</h1>
        <div className="flex items-center gap-2">
          <button onClick={onImport} className={SECONDARY} style={{ border: '0.5px solid var(--color-border-hover)' }} data-flow-import>
            <Upload size={12} strokeWidth={2} />
            Import
          </button>
          <button onClick={onCreate} className="inline-flex items-center gap-1.5 h-[26px] px-3 rounded-[6px] bg-accent text-white hover:opacity-90 text-[11px]">
            <Plus size={12} strokeWidth={2} />
            New Flow
          </button>
        </div>
      </div>

      {GROUPS.map((group) => {
        const rows = projects.filter((p) => groupFor(p) === group.id);
        return (
          <section key={group.id} className="mb-6" data-flow-group={group.id}>
            <h2 className="text-[11px] font-medium text-text-muted mb-2">
              {group.label}
              <span className="text-text-dim"> · {rows.length}</span>
            </h2>
            {rows.length === 0 ? (
              <p className="text-[11px] text-text-dim">{group.empty}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {rows.map((project) => (
                  <FlowProjectCard key={project.id} project={project} readOnly={group.id === 'builtin'} onOpen={onOpen} onAction={onAction} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
