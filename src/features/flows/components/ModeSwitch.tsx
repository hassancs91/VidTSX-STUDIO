import { Pause, FastForward } from 'lucide-react';
import type { FlowRunMode } from '@shared/types/flows';

interface Props {
  value: FlowRunMode;
  onChange: (mode: FlowRunMode) => void;
  disabled?: boolean;
}

/** Decision 4's run-level switch: with checkpoints, or unattended. */
export function ModeSwitch({ value, onChange, disabled }: Props) {
  const options: { value: FlowRunMode; label: string; icon: typeof Pause; title: string }[] = [
    { value: 'attended', label: 'Checkpoints', icon: Pause, title: 'Pause at each marked step for your review' },
    { value: 'unattended', label: 'Unattended', icon: FastForward, title: 'Run straight through, no pauses' },
  ];
  return (
    <div
      className="inline-flex items-center rounded-[6px] bg-app-base p-[2px] shrink-0"
      style={{ border: '0.5px solid var(--color-border-input)' }}
      role="radiogroup"
      data-mode-switch={value}
    >
      {options.map(({ value: v, label, icon: Icon, title }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex items-center gap-1 h-[20px] px-2 rounded-[4px] text-[11px] transition-colors disabled:opacity-40 ${
              active ? 'bg-app-active text-accent-light' : 'text-text-muted hover:text-text-secondary'
            }`}
            data-mode-option={v}
          >
            <Icon size={10} strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
