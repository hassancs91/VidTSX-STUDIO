import { Link2, Link2Off } from 'lucide-react';
import type { FlowParam } from '@shared/types/flows';

interface Props {
  /** The param this field is bound to, when it is. */
  bound: FlowParam | null;
  onExpose: () => void;
  onUnexpose: () => void;
}

/**
 * "Expose as parameter" per inspector field (flows plan §1.8): creates a
 * `params[]` entry bound to the field's key, or removes it. A bound field
 * shows locked in the inspector — the run form owns its value.
 */
export function ExposeParamToggle({ bound, onExpose, onUnexpose }: Props) {
  return (
    <button
      type="button"
      onClick={bound ? onUnexpose : onExpose}
      title={bound ? `Bound to the run parameter "${bound.label}" — click to unbind` : 'Expose as a run parameter'}
      className={`flex items-center gap-1 shrink-0 h-[18px] px-1.5 rounded-[4px] text-[10px] transition-colors ${
        bound ? 'bg-app-active text-accent-light' : 'text-text-dim hover:text-text-secondary hover:bg-app-hover'
      }`}
      data-expose-toggle={bound ? 'bound' : 'free'}
    >
      {bound ? <Link2 size={10} strokeWidth={2} /> : <Link2Off size={10} strokeWidth={2} />}
      {bound ? `Param: ${bound.id}` : 'Expose'}
    </button>
  );
}
