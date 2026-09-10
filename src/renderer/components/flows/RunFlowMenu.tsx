import { ChevronRight, Workflow } from 'lucide-react';
import { useState } from 'react';
import { useFlowHandoffs } from '@renderer/hooks/flows/useFlowHandoffs';

interface Props {
  /** What the item is — decides which flows are offered. */
  kind: 'image' | 'video';
  /** The value the param receives: an absolute path, or a library entry id. */
  value: string;
  /** Called after a flow was chosen (close the menu). */
  onDone: () => void;
  /** `submenu` = one row that opens the list to the side (a context menu);
   *  `list` = the rows themselves (a popover of its own). */
  variant?: 'submenu' | 'list';
}

const ROW = 'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-text-secondary hover:bg-app-hover';

/**
 * "Run a flow on this" (flows plan §1.8, W8 Stage 6): the flows whose run
 * form takes an `image` / `video` param, one row per (flow, param). Shared
 * by the Library's context menu and the Video Studio card; neither feature
 * imports the Flows feature — the hop is the hand-off event.
 */
export function RunFlowMenu({ kind, value, onDone, variant = 'submenu' }: Props) {
  const { targets, loaded, runFlowOn } = useFlowHandoffs(kind);
  const [open, setOpen] = useState(variant === 'list');

  const rows =
    targets.length === 0 ? (
      <div className="px-3 py-1.5 text-[11px] text-text-dim" data-run-flow-empty>
        {loaded ? `No flow takes a ${kind} yet` : 'Loading flows…'}
      </div>
    ) : (
      targets.map((t) => (
        <button
          key={`${t.flowId}:${t.paramId}`}
          type="button"
          className={ROW}
          data-run-flow-target={t.flowId}
          onClick={() => {
            runFlowOn(t, value);
            onDone();
          }}
        >
          <Workflow size={12} strokeWidth={1.75} className="opacity-70" />
          <span className="truncate">{t.flowName}</span>
          <span className="ml-auto text-[10px] text-text-dim">{t.paramLabel}</span>
        </button>
      ))
    );

  if (variant === 'list') return <div data-run-flow-menu>{rows}</div>;

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} data-run-flow-menu>
      <button type="button" className={ROW} onClick={() => setOpen((v) => !v)} data-run-flow-open>
        <Workflow size={12} strokeWidth={1.75} className="opacity-70" />
        <span>Run a flow on this</span>
        <ChevronRight size={12} strokeWidth={1.75} className="ml-auto opacity-60" />
      </button>
      {open && (
        <div
          className="absolute left-full top-0 -mt-1 ml-0.5 min-w-[200px] py-1 rounded-md bg-app-surface shadow-lg z-50"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {rows}
        </div>
      )}
    </div>
  );
}
