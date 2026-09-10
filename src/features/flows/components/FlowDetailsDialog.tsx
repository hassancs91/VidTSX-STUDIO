import { useEffect, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import type { FlowProject } from '@shared/ipc/types';
import type { FlowDoc } from '@shared/types/flows';
import { parseFlowDoc } from '@shared/flows/migrate-v1';
import { trustTagForFlow } from '../services/flow-trust';

interface Props {
  flowId: string | null;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[11px]">
      <span className="w-[88px] shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-text-secondary break-words">{children}</span>
    </div>
  );
}

/** "Details" from the card menu (flows plan §1.8): what the flow is, asks for, and produces. */
export function FlowDetailsDialog({ flowId, onClose }: Props) {
  const [project, setProject] = useState<FlowProject | null>(null);
  const [doc, setDoc] = useState<FlowDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flowId) {
      setProject(null);
      setDoc(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void window.api.flowsProjectLoad({ id: flowId }).then((res) => {
      if (cancelled) return;
      if (!res.success || !res.project) {
        setError(res.error ?? 'Failed to load the flow');
        return;
      }
      setProject(res.project);
      setDoc(parseFlowDoc(res.project.graphJson, { id: res.project.id, name: res.project.name, description: res.project.description }));
    });
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  return (
    <Modal isOpen={flowId !== null} onClose={onClose} title={project?.name ?? 'Flow details'}>
      <div className="flex flex-col gap-2 min-w-[360px] max-w-[480px]" data-flow-details>
        {error ? <p className="text-[11px] text-accent-red">{error}</p> : null}
        {project && doc ? (
          <>
            {doc.description ? <p className="text-[11px] text-text-secondary leading-snug">{doc.description}</p> : null}
            <Row label="Source">{project.source}</Row>
            {project.package ? (
              <>
                <Row label="Trust">
                  <span
                    className={trustTagForFlow(project).tone === 'accent' ? 'text-accent-light' : 'text-accent-amber'}
                    data-flow-trust={trustTagForFlow(project).id}
                  >
                    {trustTagForFlow(project).label}
                  </span>
                  {trustTagForFlow(project).notice ? <span className="block text-[10px] text-text-dim mt-0.5">{trustTagForFlow(project).notice}</span> : null}
                </Row>
                <Row label="Version">{project.package.version}</Row>
                <Row label="Author">{project.package.author}</Row>
                {project.package.viaAgent ? <Row label="Ships with">{`${project.package.viaAgent.name} (agent)`}</Row> : null}
              </>
            ) : null}
            <Row label="Updated">{new Date(project.updatedAt).toLocaleString()}</Row>
            <Row label="Steps">
              {doc.graph.nodes.length} node{doc.graph.nodes.length === 1 ? '' : 's'}, {doc.graph.edges.length} edge{doc.graph.edges.length === 1 ? '' : 's'}
              {doc.graph.nodes.some((n) => n.pause) ? ` · ${doc.graph.nodes.filter((n) => n.pause).length} checkpoint(s)` : ''}
            </Row>
            <Row label="Parameters">
              {doc.params.length === 0 ? 'none — every value is fixed' : doc.params.map((p) => `${p.label} (${p.kind}${p.required ? ', required' : ''})`).join(', ')}
            </Row>
            <Row label="Outputs">{doc.outputs.map((o) => o.label).join(', ') || 'none'}</Row>
            {doc.origin ? <Row label="Frozen from">{`${doc.origin.agentId} · session ${doc.origin.sessionId}`}</Row> : null}
            <Row label="Id">
              <span className="font-mono text-[10px] text-text-dim">{project.id}</span>
            </Row>
          </>
        ) : !error ? (
          <p className="text-[11px] text-text-dim">Loading…</p>
        ) : null}
      </div>
    </Modal>
  );
}
