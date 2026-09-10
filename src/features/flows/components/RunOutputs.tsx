import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AgentArtifact, InteractionReply } from '@shared/types/agents';
import type { AgentArtifactActionKind } from '@shared/ipc/types';
import type { FlowDoc, FlowPortValue, NodeSpec } from '@shared/types/flows';
import { getArtifactViewer } from '@renderer/components/artifact-viewers/registry';
import { ActionBar } from '@renderer/components/artifact-viewers/ActionBar';
import { useToast } from '@renderer/contexts/ToastContext';
import type { RunState } from '../hooks/useFlowRun';
import { useRunArtifactViewer } from '../hooks/useRunArtifactViewer';
import { useRunArtifactActions } from '../hooks/useRunArtifactActions';
import { PauseCard } from './PauseCard';
import { StepsStrip } from './StepsStrip';

interface Props {
  doc: FlowDoc;
  specs: Record<string, NodeSpec>;
  runState: RunState;
  onReply: (reply: InteractionReply) => Promise<string | null>;
}

/** The flow's declared outputs, resolved against the run: artifacts or text. */
function declaredOutputs(doc: FlowDoc, runState: RunState): Array<{ label: string; value: FlowPortValue }> {
  const out: Array<{ label: string; value: FlowPortValue }> = [];
  for (const o of doc.outputs) {
    const value = runState.nodes[o.nodeId]?.outputs?.[o.handle];
    if (value) out.push({ label: o.label, value });
  }
  return out;
}

/**
 * The run form's right pane (flows plan §1.4): the flow's `outputs` large
 * through the SHARED viewer registry with the SHARED action bar, a pending
 * checkpoint over it with the shared cards, and the steps strip below.
 */
export function RunOutputs({ doc, specs, runState, onReply }: Props) {
  const { showToast } = useToast();
  const outputs = useMemo(() => declaredOutputs(doc, runState), [doc, runState]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The first declared output with an artifact is what shows by default; a
  // new run resets the choice.
  const firstArtifact = outputs.find((o) => o.value.kind === 'artifact');
  const firstId = firstArtifact?.value.kind === 'artifact' ? firstArtifact.value.artifactId : null;
  useEffect(() => {
    setSelectedId(null);
  }, [runState.runId]);
  const artifactId = selectedId ?? firstId;
  const selected: AgentArtifact | null = artifactId ? (runState.artifacts.find((a) => a.id === artifactId) ?? null) : null;

  const { resolved, loading, error } = useRunArtifactViewer(runState.runId, selected);
  const actions = useRunArtifactActions(runState.runId);
  const Viewer = selected ? getArtifactViewer(selected.kind) : null;
  const textOutputs = outputs.filter((o) => o.value.kind !== 'artifact');

  const runAction = async (action: AgentArtifactActionKind) => {
    if (!selected) return;
    const result = await actions.run(selected.id, action);
    showToast(result.message, result.ok ? 'success' : 'error');
  };

  const pending = runState.pending;

  return (
    <div className="flex flex-col h-full min-h-0 bg-app-player" data-run-outputs>
      <div className="flex-1 min-h-0 relative">
        {selected && Viewer ? (
          <Viewer artifact={selected} resolved={resolved} loading={loading} {...(error !== undefined ? { error } : {})} />
        ) : textOutputs.length > 0 ? (
          <div className="h-full overflow-y-auto p-4 space-y-3">
            {textOutputs.map((o, i) => (
              <div key={`${o.label}-${i}`} className="rounded-[8px] bg-app-surface p-3" style={{ border: '0.5px solid var(--color-border)' }}>
                <div className="text-[11px] font-medium text-text-muted mb-1">{o.label}</div>
                <pre className="text-[12px] text-text-secondary whitespace-pre-wrap font-[inherit]" data-text-output>
                  {String(o.value.kind === 'artifact' ? '' : o.value.value)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <OutputsEmpty status={runState.status} />
        )}
        {pending ? (
          <div className="absolute inset-0 z-10 flex items-stretch justify-center bg-app-player/90 p-4">
            <PauseCard
              pending={pending}
              node={runState.nodes[pending.nodeId]}
              artifacts={runState.artifacts}
              assetUrls={runState.assetUrls}
              busy={runState.replying}
              onReply={(reply) =>
                void onReply(reply).then((err) => {
                  if (err) showToast(err, 'error');
                })
              }
            />
          </div>
        ) : null}
      </div>

      {selected ? (
        <ActionBar artifact={selected} running={actions.running} studioProjectOpen={actions.studioProjectOpen} onRun={(a) => void runAction(a)} />
      ) : null}

      {runState.runId ? (
        <StepsStrip doc={doc} specs={specs} runState={runState} selectedArtifactId={selected?.id ?? null} onSelect={setSelectedId} />
      ) : null}
    </div>
  );
}

function OutputsEmpty({ status }: { status: RunState['status'] }) {
  const running = status === 'queued' || status === 'running' || status === 'paused';
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center px-6">
      <Sparkles size={48} strokeWidth={1} className={running ? 'text-accent animate-pulse' : 'text-text-ghost'} />
      <div className="text-[14px] text-text-muted">{running ? 'Working…' : 'Nothing made yet'}</div>
      <div className="text-[12px] text-text-dim max-w-[320px] leading-snug">
        {running ? 'Outputs appear here as the steps finish.' : 'Fill in the parameters and press Run. The flow’s outputs appear here.'}
      </div>
    </div>
  );
}
