import { AlertTriangle } from 'lucide-react';
import type { ConfigField } from '@shared/types/flows';
import { useNodeSpec } from '../hooks/useNodeSpecs';
import { needLabel } from '../services/node-style';
import { TextField } from '@renderer/components/fields/TextField';
import { PromptField } from '@renderer/components/fields/PromptField';
import { NumberField } from '@renderer/components/fields/NumberField';
import { SelectField } from '@renderer/components/fields/SelectField';
import { ModelPickerField } from '@renderer/components/fields/ModelPickerField';
import { LlmModelPickerField } from '@renderer/components/fields/LlmModelPickerField';
import { VideoModelPickerField } from '@renderer/components/fields/VideoModelPickerField';
import { VideoModelOptionsField } from '@renderer/components/fields/VideoModelOptionsField';
import { GalleryImagePickerField } from '@renderer/components/fields/GalleryImagePickerField';
import { ImageUploadField } from '@renderer/components/fields/ImageUploadField';

interface Props {
  toolId: string;
  config: Record<string, unknown>;
  onPatchConfig: (patch: Record<string, unknown>) => void;
}

interface UploadValue {
  base64: string;
  fileName: string;
  width: number;
  height: number;
  contentType: string;
}

const EMPTY_UPLOAD: UploadValue = {
  base64: '',
  fileName: '',
  width: 0,
  height: 0,
  contentType: 'image/jpeg',
};

function asUploadValue(raw: unknown, config: Record<string, unknown>): UploadValue {
  return {
    base64: typeof raw === 'string' ? raw : '',
    fileName: typeof config.fileName === 'string' ? config.fileName : '',
    width: typeof config.width === 'number' ? config.width : 0,
    height: typeof config.height === 'number' ? config.height : 0,
    contentType: typeof config.contentType === 'string' ? config.contentType : 'image/jpeg',
  };
}

function renderField(
  field: ConfigField,
  config: Record<string, unknown>,
  patch: (p: Record<string, unknown>) => void,
) {
  const value = config[field.key];
  switch (field.kind) {
    case 'text':
      return (
        <TextField
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => patch({ [field.key]: next })}
          placeholder={field.placeholder}
        />
      );
    case 'prompt':
      return (
        <PromptField
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => patch({ [field.key]: next })}
          placeholder={field.placeholder}
          rows={field.rows}
        />
      );
    case 'number':
      return (
        <NumberField
          label={field.label}
          value={typeof value === 'number' ? value : 0}
          onChange={(next) => patch({ [field.key]: next })}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    case 'select':
      return (
        <SelectField
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => patch({ [field.key]: next })}
          options={field.options}
        />
      );
    case 'model-picker': {
      const providerKeyKey = field.providerKeyKey ?? 'providerId';
      const providerId = config[providerKeyKey];
      return (
        <ModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) =>
            patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })
          }
        />
      );
    }
    case 'llm-model-picker': {
      const providerKeyKey = field.providerKeyKey ?? 'providerId';
      const providerId = config[providerKeyKey];
      return (
        <LlmModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) =>
            patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })
          }
        />
      );
    }
    case 'video-model-picker': {
      const providerKeyKey = field.providerKeyKey ?? 'providerId';
      const providerId = config[providerKeyKey];
      return (
        <VideoModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) =>
            patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })
          }
        />
      );
    }
    case 'video-model-options': {
      const providerKeyKey = field.providerKeyKey ?? 'providerId';
      const providerId = config[providerKeyKey];
      const model = config[field.modelKey ?? 'model'];
      return (
        <VideoModelOptionsField
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof model === 'string' ? model : ''}
          config={config}
          onPatch={patch}
        />
      );
    }
    case 'gallery-image-picker':
      return (
        <GalleryImagePickerField
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => patch({ [field.key]: next })}
        />
      );
    case 'image-upload':
      return (
        <ImageUploadField
          label={field.label}
          value={asUploadValue(value, config)}
          onChange={(next) =>
            patch({
              [field.key]: next.base64,
              fileName: next.fileName,
              width: next.width,
              height: next.height,
              contentType: next.contentType,
            })
          }
        />
      );
  }
}

export function NodeInspector({ toolId, config, onPatchConfig }: Props) {
  const spec = useNodeSpec(toolId);

  if (!spec) {
    return (
      <div className="p-3 text-[11px] text-accent-red">
        Unknown node: {toolId}
      </div>
    );
  }
  const unmet = spec.available === false ? (spec.needs ?? []) : [];

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      <div>
        <h3 className="text-[13px] font-semibold text-text-primary">{spec.label}</h3>
        <p className="text-[11px] text-text-dim mt-0.5">{spec.description}</p>
        {unmet.length > 0 && (
          <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle size={11} strokeWidth={2} />
            Needs {unmet.map(needLabel).join(', ')} — add one in AI → Providers.
          </p>
        )}
        {spec.priced && (
          <p className="text-[11px] text-text-dim mt-1">Priced step{spec.priceHint ? `: ${spec.priceHint}` : ''}.</p>
        )}
      </div>

      {spec.configSchema.length === 0 ? (
        <p className="text-[11px] text-text-dim">This node has no settings.</p>
      ) : (
        spec.configSchema.map((field) => (
          <div key={field.key + '-' + field.kind}>
            {renderField(field, config, onPatchConfig)}
          </div>
        ))
      )}
    </div>
  );
}
