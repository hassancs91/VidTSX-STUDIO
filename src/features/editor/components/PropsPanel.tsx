import { PropField } from './PropField';
import type { ExtractedProp, PropValue } from '../types';

export interface PropsPanelProps {
  props: ExtractedProp[];
  /** User overrides keyed by prop name. */
  values: Record<string, PropValue>;
  onChange: (name: string, value: PropValue) => void;
  onReset: () => void;
  className?: string;
}

/**
 * Sidebar of auto-generated controls for a composition's editable props.
 * Changes affect only the live preview — the source file is untouched.
 */
export function PropsPanel({ props, values, onChange, onReset, className = '' }: PropsPanelProps) {
  const hasOverrides = Object.keys(values).length > 0;

  return (
    <div
      className={`flex flex-col bg-app-surface rounded-lg overflow-hidden ${className}`}
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between px-3 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-primary">Props</span>
        {hasOverrides && (
          <button
            onClick={onReset}
            className="text-[10px] text-text-dim hover:text-text-primary transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {props.length === 0 ? (
          <span className="text-[10px] text-text-dim">No editable props</span>
        ) : (
          props.map((prop) => (
            <PropField
              key={prop.name}
              prop={prop}
              value={values[prop.name]}
              onChange={(value) => onChange(prop.name, value)}
            />
          ))
        )}
      </div>

      <div
        className="shrink-0 px-3 py-2 text-[9px] text-text-dim leading-relaxed"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        Preview only — edit the code to make changes permanent.
      </div>
    </div>
  );
}
