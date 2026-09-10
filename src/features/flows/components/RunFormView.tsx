import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Play, RotateCcw, Square } from 'lucide-react';
import type { InteractionReply } from '@shared/types/agents';
import type { FlowDoc, FlowRunMode, NodeSpec } from '@shared/types/flows';
import { hasPauseNode, initialParamValues, missingRequiredParams } from '@shared/flows/params';
import { BrandSelect } from '@renderer/components/agents/BrandSelect';
import { useAgentBrandList } from '@renderer/hooks/agents/useAgentBrandList';
import { isRunActive, type RunOptions, type RunState } from '../hooks/useFlowRun';
import { needLabel } from '../services/node-style';
import { ModeSwitch } from './ModeSwitch';
import { ParamField } from './ParamField';
import { PricedStepsLine } from './PricedStepsLine';
import { RunOutputs } from './RunOutputs';

interface Props {
  doc: FlowDoc;
  specs: Record<string, NodeSpec>;
  runState: RunState;
  /** Prefilled params (§12 open question 1) — a handoff from Library, Video Studio or Stage 4. */
  prefill?: Record<string, unknown>;
  onRun: (options: RunOptions) => void;
  onCancel: () => void;
  onResume: () => void;
  onReply: (reply: InteractionReply) => Promise<string | null>;
}

/** Nodes whose capability gate is unmet — the "needs" chip and the Run block. */
function unmetNeeds(doc: FlowDoc, specs: Record<string, NodeSpec>): string[] {
  const needs = new Set<string>();
  for (const node of doc.graph.nodes) {
    const spec = specs[node.toolId];
    if (spec?.available === false) for (const n of spec.needs ?? []) needs.add(n);
  }
  return [...needs];
}

const SECONDARY = 'flex items-center gap-1.5 h-[26px] px-3 rounded-[6px] text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40';

/**
 * The run form (flows plan §1.4): `params` in order with the shared field
 * components, the brand picker beside the mode switch, the priced-steps
 * line, Run / Cancel / Resume, and the outputs pane on the right.
 */
export function RunFormView({ doc, specs, runState, prefill, onRun, onCancel, onResume, onReply }: Props) {
  const pausable = hasPauseNode(doc);
  const [values, setValues] = useState<Record<string, unknown>>(() => initialParamValues(doc.params, prefill));
  const [mode, setMode] = useState<FlowRunMode>(pausable ? 'attended' : 'unattended');
  // Run-level brand (§0.1 item 9): undefined = library default, null = none.
  const [brandId, setBrandId] = useState<string | null | undefined>(undefined);
  const brandList = useAgentBrandList();

  // A param added or removed on the canvas shows up here without a reload.
  useEffect(() => {
    setValues((prev) => ({ ...initialParamValues(doc.params, prefill), ...prev }));
  }, [doc.params, prefill]);
  useEffect(() => {
    if (!pausable) setMode('unattended');
  }, [pausable]);

  const active = isRunActive(runState.status);
  const missing = useMemo(() => missingRequiredParams(doc.params, values), [doc.params, values]);
  const needs = useMemo(() => unmetNeeds(doc, specs), [doc, specs]);
  const blocked = missing.length > 0 ? `${missing[0].label} is required` : needs.length > 0 ? `Needs ${needs.map(needLabel).join(', ')}` : null;
  const effectiveBrand = brandId === undefined ? (brandList.defaultBrandId ?? null) : brandId;

  return (
    <div className="flex h-full min-h-0" data-run-form data-run-form-status={runState.status}>
      <aside className="w-[340px] shrink-0 flex flex-col bg-app-surface" style={{ borderRight: '0.5px solid var(--color-border)' }}>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
          {doc.description ? <p className="text-[11px] text-text-muted leading-snug">{doc.description}</p> : null}
          {doc.params.length === 0 ? (
            <p className="text-[11px] text-text-dim leading-snug">
              This flow has no parameters — every value is fixed on the canvas. Expose a field from the Edit view to ask for it here.
            </p>
          ) : (
            doc.params.map((param) => (
              <ParamField
                key={param.id}
                param={param}
                value={values[param.id]}
                onChange={(next) => setValues((prev) => ({ ...prev, [param.id]: next }))}
                disabled={active}
              />
            ))
          )}
        </div>

        <div className="shrink-0 p-3 flex flex-col gap-2.5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <BrandSelect
                brands={brandList.brands}
                brandId={effectiveBrand}
                onChange={(next) => setBrandId(next)}
                disabled={active || !brandList.loaded}
              />
            </div>
            {pausable && <ModeSwitch value={mode} onChange={setMode} disabled={active} />}
          </div>
          <PricedStepsLine doc={doc} specs={specs} />
          {needs.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-accent-amber" data-needs-chip={needs.join(',')}>
              <AlertTriangle size={11} strokeWidth={2} />
              Needs {needs.map(needLabel).join(', ')} — add one in AI → Providers.
            </div>
          )}
          {runState.status === 'error' && runState.error ? (
            <div className="text-[11px] text-accent-red leading-snug" data-run-error>
              {runState.error}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {active ? (
              <button onClick={onCancel} className={SECONDARY} style={{ border: '0.5px solid var(--color-border-hover)' }} data-run-cancel>
                <Square size={11} strokeWidth={2} />
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={() => onRun({ mode, params: values, ...(brandId !== undefined ? { brandId } : {}) })}
                  disabled={blocked !== null}
                  title={blocked ?? (mode === 'attended' ? 'Run with checkpoints' : 'Run unattended')}
                  className="flex items-center gap-1.5 h-[26px] px-3 rounded-[6px] bg-accent text-white hover:opacity-90 text-[11px] font-medium disabled:opacity-40"
                  data-run-start
                >
                  <Play size={11} strokeWidth={2} fill="currentColor" />
                  Run
                </button>
                {runState.resumable && (
                  <button onClick={onResume} className={SECONDARY} style={{ border: '0.5px solid var(--color-border-hover)' }} title="Rerun from the first step that did not finish" data-run-resume>
                    <RotateCcw size={11} strokeWidth={2} />
                    Resume
                  </button>
                )}
              </>
            )}
            <span className="text-[10px] text-text-dim truncate min-w-0">{active ? (runState.status === 'paused' ? 'Waiting for you' : 'Running…') : (blocked ?? '')}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <RunOutputs doc={doc} specs={specs} runState={runState} onReply={onReply} />
      </div>
    </div>
  );
}
