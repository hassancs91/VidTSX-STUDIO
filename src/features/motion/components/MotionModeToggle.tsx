// `Prompt | Agent | Templates` at the top of the Creator's input panel (W7;
// Templates: docs/templates-plan.md).

export type MotionInputMode = 'prompt' | 'agent' | 'templates';

interface Props {
  mode: MotionInputMode;
  onChange: (mode: MotionInputMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ value: MotionInputMode; label: string; title: string }> = [
  { value: 'prompt', label: 'Prompt', title: 'One prompt, one generation' },
  { value: 'agent', label: 'Agent', title: 'Talk to TSX Composer; every version lands here' },
  { value: 'templates', label: 'Templates', title: 'Ready-made compositions you fill in — no prompt' },
];

export function MotionModeToggle({ mode, onChange, disabled }: Props) {
  return (
    <div
      className="flex rounded-[6px] overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
      role="tablist"
      data-motion-mode
    >
      {MODES.map((m, i) => (
        <button
          key={m.value}
          role="tab"
          aria-selected={mode === m.value}
          title={m.title}
          onClick={() => onChange(m.value)}
          disabled={disabled}
          className={`px-2.5 py-[3px] text-[10px] font-medium transition-colors duration-150 cursor-pointer ${
            mode === m.value ? 'bg-accent text-white' : 'bg-app-base text-text-muted hover:bg-app-hover'
          }`}
          style={{ borderRight: i < MODES.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
