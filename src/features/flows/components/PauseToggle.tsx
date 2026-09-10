import { Pause } from 'lucide-react';

interface Props {
  pause: boolean;
  onChange: (pause: boolean) => void;
}

/** Decision 4: "pause after this node" — honoured in runs with checkpoints, ignored unattended. */
export function PauseToggle({ pause, onChange }: Props) {
  return (
    <label
      className="flex items-center gap-2 rounded-[6px] px-2.5 py-2 cursor-pointer select-none bg-app-base"
      style={{ border: `0.5px solid ${pause ? 'var(--color-accent)' : 'var(--color-border)'}` }}
      data-pause-toggle={pause ? 'on' : 'off'}
    >
      <input type="checkbox" checked={pause} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      <Pause size={11} strokeWidth={2} className={pause ? 'text-accent-light' : 'text-text-dim'} />
      <span className="flex-1 min-w-0">
        <span className={`block text-[11px] ${pause ? 'text-accent-light' : 'text-text-secondary'}`}>Pause after this step</span>
        <span className="block text-[10px] text-text-dim leading-snug">
          Runs with checkpoints stop here for a pick, an approval, or an edit.
        </span>
      </span>
    </label>
  );
}
