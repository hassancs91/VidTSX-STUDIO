import { useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { FlowNodeRunStatus, FlowPortValue, NodeSpec, PortDef } from '@shared/types/flows';
import { useNodeSpec } from '../hooks/useNodeSpecs';
import { useNodeRunState, useRunArtifacts } from '../hooks/useFlowRun';
import { DATA_TYPE_COLOR, DATA_TYPE_LABEL, needLabel } from '../services/node-style';
import type { FlowCanvasNodeData } from '../types';

const HANDLE_SIZE = 10;

const STATUS_BORDER: Record<FlowNodeRunStatus, string> = {
  idle: 'var(--color-border)',
  running: 'var(--color-accent)',
  paused: 'var(--color-accent)',
  done: '#34d399',
  error: 'var(--color-accent-red)',
  skipped: 'var(--color-border)',
};

function PortHandle({
  port,
  position,
  index,
  total,
}: {
  port: PortDef;
  position: Position;
  index: number;
  total: number;
}) {
  const [hovered, setHovered] = useState(false);
  const offset = total === 1 ? 50 : 25 + (50 * index) / Math.max(1, total - 1);
  const isInput = position === Position.Left;

  return (
    <>
      <Handle
        id={port.id}
        type={isInput ? 'target' : 'source'}
        position={position}
        style={{
          top: `${offset}%`,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          background: DATA_TYPE_COLOR[port.dataType],
          border: '2px solid #1a1a1e',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none whitespace-nowrap px-2 py-1 rounded-md bg-app-deep shadow-lg"
          style={{
            top: `${offset}%`,
            transform: 'translateY(-50%)',
            border: '0.5px solid var(--color-border)',
            ...(isInput ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' }),
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DATA_TYPE_COLOR[port.dataType] }} />
            <span className="text-[11px] font-medium text-text-primary">{port.label}</span>
            {port.required && (
              <span className="text-[9px] uppercase tracking-wider text-accent-red">required</span>
            )}
          </div>
          <div className="text-[9px] text-text-dim mt-0.5 pl-3">
            {DATA_TYPE_LABEL[port.dataType]} · {isInput ? 'input' : 'output'}
          </div>
        </div>
      )}
    </>
  );
}

function StatusIndicator({ status, error }: { status: FlowNodeRunStatus; error?: string }) {
  if (status === 'idle') return null;
  if (status === 'running' || status === 'paused') {
    return <Loader2 size={12} strokeWidth={2} className="animate-spin text-accent absolute top-2 right-2" />;
  }
  if (status === 'done') {
    return <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" title="Done" />;
  }
  if (status === 'error') {
    return <AlertCircle size={12} strokeWidth={2} className="text-accent-red absolute top-2 right-2" aria-label={error} />;
  }
  return (
    <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-text-dim">Skipped</span>
  );
}

function MediaFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-2">
      <div
        className="rounded bg-app-deep overflow-hidden flex items-center justify-center"
        style={{ height: 120, border: '0.5px solid var(--color-border)' }}
      >
        {children}
      </div>
    </div>
  );
}

/** One output port's value: an image or video from the run's asset urls, or
 *  a text clamp. Ports carry references; the urls arrive with the run. */
function OutputPreview({ spec, outputs }: { spec: NodeSpec; outputs?: Record<string, FlowPortValue> }) {
  const { assetUrls } = useRunArtifacts();
  if (!outputs) return null;
  const port = spec.outputs[0];
  const value = port ? outputs[port.id] : undefined;
  if (!value) return null;
  if (value.kind === 'artifact') {
    const url = assetUrls[value.artifactId]?.[0];
    if (!url) return null;
    if (value.artifactKind === 'video') {
      return (
        <MediaFrame>
          <video src={url} controls muted playsInline className="max-w-full max-h-full object-contain" />
        </MediaFrame>
      );
    }
    if (value.artifactKind === 'image-set') {
      return (
        <MediaFrame>
          <img src={url} alt={port?.label ?? 'Output'} className="max-w-full max-h-full object-contain" />
        </MediaFrame>
      );
    }
    return null;
  }
  const text = String(value.value);
  if (text.length === 0) return null;
  return (
    <div className="px-2 pb-2 text-[10px] text-text-muted line-clamp-3 break-words" title={text}>
      {text}
    </div>
  );
}

export function CustomNode({ id, data, selected }: NodeProps<FlowCanvasNodeData>) {
  const spec = useNodeSpec(data.toolId);
  const runState = useNodeRunState(id);

  if (!spec) {
    return (
      <div
        className="px-3 py-2 rounded-md bg-app-surface text-[11px] text-accent-red"
        style={{ border: '1px solid var(--color-accent-red)' }}
      >
        Unknown node: {data.toolId}
      </div>
    );
  }

  const minHeight = Math.max(spec.inputs.length, spec.outputs.length, 1) * 22 + 32;
  const borderColor = selected ? 'var(--color-accent)' : STATUS_BORDER[runState.status];
  const borderWidth = selected || runState.status !== 'idle' ? '1px' : '0.5px';
  const unmet = spec.available === false ? (spec.needs ?? []) : [];

  return (
    <div
      className="rounded-md bg-app-surface text-text-primary"
      style={{
        width: 220,
        minHeight,
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow:
          selected ? '0 0 0 2px rgba(127, 119, 221, 0.25)'
          : runState.status === 'running' ? '0 0 0 2px rgba(127, 119, 221, 0.18)'
          : 'none',
      }}
    >
      <div className="relative px-3 py-2">
        <div className="text-[12px] font-semibold truncate pr-5">{spec.label}</div>
        <div className="text-[10px] uppercase tracking-wider text-text-dim mt-0.5">{spec.category}</div>
        <StatusIndicator status={runState.status} error={runState.error} />
      </div>

      {unmet.length > 0 && (
        <div
          className="mx-2 mb-2 px-2 py-1 rounded text-[10px] flex items-center gap-1 text-amber-400"
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '0.5px solid rgba(245, 158, 11, 0.3)' }}
          data-needs-chip={unmet.join(',')}
        >
          <AlertTriangle size={10} strokeWidth={2} />
          Needs {unmet.map(needLabel).join(', ')}
        </div>
      )}

      {runState.status === 'done' && <OutputPreview spec={spec} outputs={runState.outputs} />}

      {runState.status === 'error' && runState.error && (
        <div
          className="mx-2 mb-2 px-2 py-1 rounded text-[10px] text-accent-red"
          style={{ background: 'rgba(244, 63, 94, 0.08)', border: '0.5px solid rgba(244, 63, 94, 0.3)' }}
        >
          {runState.error}
        </div>
      )}

      {spec.inputs.map((port, i) => (
        <PortHandle key={'in-' + port.id} port={port} position={Position.Left} index={i} total={spec.inputs.length} />
      ))}
      {spec.outputs.map((port, i) => (
        <PortHandle key={'out-' + port.id} port={port} position={Position.Right} index={i} total={spec.outputs.length} />
      ))}
    </div>
  );
}
