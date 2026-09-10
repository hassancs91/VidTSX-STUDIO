import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2, Pause, Circle, MinusCircle } from 'lucide-react';
import type { FlowDoc, FlowNodeRunState, FlowPortValue, NodeSpec } from '@shared/types/flows';
import type { RunState } from '../hooks/useFlowRun';

interface Props {
  doc: FlowDoc;
  specs: Record<string, NodeSpec>;
  runState: RunState;
  selectedArtifactId: string | null;
  onSelect: (artifactId: string) => void;
}

function StatusIcon({ status }: { status: FlowNodeRunState['status'] }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 size={11} strokeWidth={1.8} className="text-accent-green" />;
    case 'error':
      return <AlertCircle size={11} strokeWidth={1.8} className="text-accent-red" />;
    case 'running':
      return <Loader2 size={11} strokeWidth={1.8} className="animate-spin text-accent" />;
    case 'paused':
      return <Pause size={11} strokeWidth={1.8} className="text-accent-light" />;
    case 'skipped':
      return <MinusCircle size={11} strokeWidth={1.8} className="text-text-dim" />;
    default:
      return <Circle size={11} strokeWidth={1.8} className="text-text-ghost" />;
  }
}

/** The node's primary output as one short line, and its artifact id if it has one. */
function summarise(value: FlowPortValue | undefined): { text: string; artifactId: string | null } {
  if (!value) return { text: '', artifactId: null };
  if (value.kind === 'artifact') return { text: value.artifactKind, artifactId: value.artifactId };
  return { text: String(value.value).slice(0, 60), artifactId: null };
}

/**
 * Earlier nodes' outputs in a collapsible strip (flows plan §1.4), so a user
 * can inspect intermediate results without opening the canvas. Clicking a
 * step with an artifact shows it in the viewer above.
 */
export function StepsStrip({ doc, specs, runState, selectedArtifactId, onSelect }: Props) {
  const [open, setOpen] = useState(true);
  const steps = doc.graph.nodes.map((node) => {
    const spec = specs[node.toolId];
    const state = runState.nodes[node.id];
    const primary = spec?.outputs[0]?.id;
    const { text, artifactId } = summarise(primary && state?.outputs ? state.outputs[primary] : undefined);
    const thumb = artifactId ? runState.assetUrls[artifactId]?.[0] : undefined;
    return { node, label: spec?.label ?? node.toolId, state, text, artifactId, thumb };
  });
  const done = steps.filter((s) => s.state?.status === 'done').length;

  return (
    <div className="shrink-0 bg-app-surface" style={{ borderTop: '0.5px solid var(--color-border)' }} data-steps-strip>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 h-[26px] text-[11px] text-text-muted hover:bg-app-hover"
      >
        {open ? <ChevronDown size={11} strokeWidth={2} /> : <ChevronRight size={11} strokeWidth={2} />}
        Steps
        <span className="text-text-dim">
          {done}/{steps.length}
        </span>
      </button>
      {open && (
        <div className="flex gap-1.5 px-2.5 pb-2 overflow-x-auto">
          {steps.map(({ node, label, state, text, artifactId, thumb }) => {
            const selected = artifactId !== null && artifactId === selectedArtifactId;
            const clickable = artifactId !== null;
            return (
              <button
                key={node.id}
                type="button"
                disabled={!clickable}
                onClick={() => artifactId && onSelect(artifactId)}
                title={state?.error ?? text}
                className={`flex flex-col shrink-0 w-[112px] rounded-[6px] p-1.5 text-left transition-colors ${
                  selected ? 'bg-app-active' : clickable ? 'bg-app-base hover:bg-app-hover' : 'bg-app-base'
                } disabled:cursor-default`}
                style={{ border: `0.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}` }}
                data-step={node.id}
                data-step-status={state?.status ?? 'idle'}
              >
                <div className="h-[40px] rounded-[4px] bg-app-player overflow-hidden flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-text-dim truncate px-1">{text || '—'}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 min-w-0">
                  <StatusIcon status={state?.status ?? 'idle'} />
                  <span className={`text-[10px] truncate ${selected ? 'text-accent-light' : 'text-text-secondary'}`}>{label}</span>
                </div>
                {node.pause && <span className="text-[9px] text-text-dim">pause</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
