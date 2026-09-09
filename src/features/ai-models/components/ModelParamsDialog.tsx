import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@shared/components';
import { ImageParamFields } from '@shared/components/ImageParamFields';
import {
  hasAnyImageParams,
  type ImageModelParams,
  type ImageParamSchema,
} from '@shared/presets/image-model-params';

export interface ModelParamsDialogProps {
  /** Display name of the model. */
  title: string;
  /** One line under the title (family / dialect / id). */
  subtitle?: string;
  /** The fields to render — from the family (local) or the dialect (cloud). Never hardcoded here. */
  schema: ImageParamSchema;
  /** The model's own defaults, shown as placeholders. */
  defaults?: ImageModelParams;
  /** The override currently stored, if any. */
  initial?: ImageModelParams;
  busy?: boolean;
  /** `null` = reset to defaults (remove the override). */
  onSave: (params: ImageModelParams | null) => Promise<boolean> | boolean;
  onCancel: () => void;
}

/**
 * Per-model generation parameters (W2c). Schema-driven: the same dialog
 * serves a local SD 1.5 checkpoint (width/height/steps/CFG/sampler/scheduler/
 * negative prompt/seed) and a cloud FLUX endpoint (steps/guidance/seed) —
 * each shows only what its schema declares. Saved values become the defaults
 * for every generation on that model until reset.
 */
export function ModelParamsDialog({
  title,
  subtitle,
  schema,
  defaults,
  initial,
  busy,
  onSave,
  onCancel,
}: ModelParamsDialogProps) {
  const [values, setValues] = useState<ImageModelParams>({ ...(initial ?? {}) });
  const hasOverride = hasAnyImageParams(initial);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial ?? {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-[460px] max-w-[92vw] bg-app-surface rounded-lg border border-border p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="model-params-dialog"
      >
        <h3 className="text-[13px] font-medium text-text-primary mb-0.5">Parameters · {title}</h3>
        {subtitle && (
          <p className="text-[11px] text-text-dim font-mono truncate mb-3" title={subtitle}>{subtitle}</p>
        )}
        <p className="text-[10px] text-text-dim mb-3">
          Empty fields use the model's defaults (shown as placeholders). Saved values apply to every
          generation on this model — Image Studio, the agents and flows alike — until you reset them.
        </p>

        <ImageParamFields schema={schema} values={values} defaults={defaults} onChange={setValues} disabled={busy} />

        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={() => void onSave(null)}
            disabled={busy || !hasOverride}
            className={`flex items-center gap-1 text-[10px] transition-colors ${
              hasOverride ? 'text-text-dim hover:text-text-secondary cursor-pointer' : 'text-text-dim opacity-50 cursor-default'
            }`}
            title="Remove the saved override so the model's own defaults apply again"
          >
            <RotateCcw size={11} strokeWidth={2} />
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onSave(hasAnyImageParams(values) ? values : null)}
              disabled={busy || !dirty || schema.fields.length === 0}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
