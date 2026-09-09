import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ImageParamFields } from '@shared/components/ImageParamFields';
import { hasAnyImageParams, type ImageModelParams } from '@shared/presets/image-model-params';
import type { ImageModelInfoIpc } from '../../../shared/ipc/types';

interface AdvancedParamsSectionProps {
  /** The model selected in the panel; its `paramSchema` decides the fields. */
  model: ImageModelInfoIpc | undefined;
  values: ImageModelParams;
  onChange: (next: ImageModelParams) => void;
  disabled?: boolean;
}

/**
 * Image Studio's per-request parameters (W2c). Renders the selected model's
 * schema — steps/CFG/sampler… for a local checkpoint, steps/guidance/seed for
 * a FLUX endpoint, nothing for Nano Banana — with the model's saved override
 * over its own defaults as placeholders. Values set here apply to this
 * request only; the gear in AI → Models sets the lasting override.
 */
export function AdvancedParamsSection({ model, values, onChange, disabled }: AdvancedParamsSectionProps) {
  const [open, setOpen] = useState(false);
  const schema = model?.paramSchema;
  if (!schema || schema.fields.length === 0) return null;

  const placeholders: ImageModelParams = { ...(model.paramDefaults ?? {}), ...(model.params ?? {}) };
  const tuned = hasAnyImageParams(values);
  const saved = hasAnyImageParams(model.params);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-text-dim hover:text-text-secondary transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={11} strokeWidth={2} /> : <ChevronRight size={11} strokeWidth={2} />}
        Advanced
        {tuned && <span className="ml-1 text-accent-light">· set for this request</span>}
        {!tuned && saved && <span className="ml-1 text-text-dim">· model defaults customized</span>}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <ImageParamFields
            schema={schema}
            values={values}
            defaults={placeholders}
            onChange={onChange}
            disabled={disabled}
            columns={2}
          />
          {tuned && (
            <button
              type="button"
              className="self-start text-[10px] text-text-dim hover:text-text-secondary"
              onClick={() => onChange({})}
            >
              Clear (use the model's defaults)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
