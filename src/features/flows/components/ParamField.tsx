import type { FlowParam } from '@shared/types/flows';
import { TextField } from '@renderer/components/fields/TextField';
import { PromptField } from '@renderer/components/fields/PromptField';
import { NumberField } from '@renderer/components/fields/NumberField';
import { SelectField } from '@renderer/components/fields/SelectField';
import { ImagePickField } from '@renderer/components/fields/ImagePickField';
import { VideoPickField } from '@renderer/components/fields/VideoPickField';

interface Props {
  param: FlowParam;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}

/** `entryId` binds read a library entry; anything else is a file path. */
function mediaSource(param: FlowParam): 'file' | 'library' {
  return param.bind.some((b) => b.key === 'entryId') ? 'library' : 'file';
}

function labelFor(param: FlowParam): string {
  return param.required ? `${param.label} *` : param.label;
}

/**
 * One run-form field (flows plan §1.4): the kind decides the shared field
 * component, so the form needs no per-flow code. Kinds the inspector owns
 * whole (model pickers, video options) render as a plain text value — a
 * flow exposes those rarely, and the value is still one string.
 */
export function ParamField({ param, value, onChange, disabled }: Props) {
  const label = labelFor(param);
  const text = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  const wrap = (node: React.ReactNode) => (
    <div data-param-field={param.id} className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      {node}
      {param.description ? <p className="text-[10px] text-text-dim mt-1 leading-snug">{param.description}</p> : null}
    </div>
  );

  switch (param.kind) {
    case 'prompt':
      return wrap(<PromptField label={label} value={text} onChange={onChange} placeholder={param.placeholder} rows={param.rows ?? 4} />);
    case 'number':
      return wrap(
        <NumberField
          label={label}
          value={typeof value === 'number' ? value : Number(text) || 0}
          onChange={onChange}
          min={param.min}
          max={param.max}
          step={param.step}
        />,
      );
    case 'select':
      return wrap(
        <SelectField
          label={label}
          value={text}
          onChange={onChange}
          options={(param.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))}
        />,
      );
    case 'image':
      return wrap(<ImagePickField label={label} value={text} onChange={onChange} source={mediaSource(param)} />);
    case 'video':
      return wrap(<VideoPickField label={label} value={text} onChange={onChange} source={mediaSource(param)} />);
    default:
      return wrap(<TextField label={label} value={text} onChange={onChange} placeholder={param.placeholder} />);
  }
}
