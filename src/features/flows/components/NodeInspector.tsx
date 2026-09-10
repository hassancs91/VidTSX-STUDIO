import { AlertTriangle, Lock } from 'lucide-react';
import type { ConfigField, FlowDoc, FlowModelMode } from '@shared/types/flows';
import { boundParam } from '@shared/flows/params';
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
import { ExposeParamToggle } from './ExposeParamToggle';
import { PauseToggle } from './PauseToggle';

interface Props {
  nodeId: string;
  toolId: string;
  config: Record<string, unknown>;
  /** The doc's params and pause flags (Stage 2); null while loading. */
  doc: FlowDoc | null;
  onPatchConfig: (patch: Record<string, unknown>) => void;
  onExpose: (field: ConfigField) => void;
  onUnexpose: (key: string) => void;
  onSetPause: (pause: boolean) => void;
}

interface UploadValue {
  base64: string;
  fileName: string;
  width: number;
  height: number;
  contentType: string;
}

function asUploadValue(raw: unknown, config: Record<string, unknown>): UploadValue {
  return {
    base64: typeof raw === 'string' ? raw : '',
    fileName: typeof config.fileName === 'string' ? config.fileName : '',
    width: typeof config.width === 'number' ? config.width : 0,
    height: typeof config.height === 'number' ? config.height : 0,
    contentType: typeof config.contentType === 'string' ? config.contentType : 'image/jpeg',
  };
}

function renderField(field: ConfigField, config: Record<string, unknown>, patch: (p: Record<string, unknown>) => void) {
  const value = config[field.key];
  const providerKeyKey = 'providerKeyKey' in field ? (field.providerKeyKey ?? 'providerId') : 'providerId';
  const providerId = config[providerKeyKey];
  switch (field.kind) {
    case 'text':
      return <TextField label={field.label} value={typeof value === 'string' ? value : ''} onChange={(next) => patch({ [field.key]: next })} placeholder={field.placeholder} />;
    case 'prompt':
      return <PromptField label={field.label} value={typeof value === 'string' ? value : ''} onChange={(next) => patch({ [field.key]: next })} placeholder={field.placeholder} rows={field.rows} />;
    case 'number':
      return <NumberField label={field.label} value={typeof value === 'number' ? value : 0} onChange={(next) => patch({ [field.key]: next })} min={field.min} max={field.max} step={field.step} />;
    case 'select':
      return <SelectField label={field.label} value={typeof value === 'string' ? value : ''} onChange={(next) => patch({ [field.key]: next })} options={field.options} />;
    case 'model-picker':
      return (
        <ModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) => patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })}
        />
      );
    case 'llm-model-picker': {
      const mode = config.modelMode;
      return (
        <LlmModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) => patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })}
          modelMode={mode === 'required' || mode === 'preferred' ? mode : 'default'}
          onModeChange={(next: FlowModelMode) => patch({ modelMode: next })}
        />
      );
    }
    case 'video-model-picker':
      return (
        <VideoModelPickerField
          label={field.label}
          providerId={typeof providerId === 'string' ? providerId : ''}
          model={typeof value === 'string' ? value : ''}
          onChange={(nextProviderId, nextModel) => patch({ [providerKeyKey]: nextProviderId, [field.key]: nextModel })}
        />
      );
    case 'video-model-options': {
      const model = config[field.modelKey ?? 'model'];
      return <VideoModelOptionsField providerId={typeof providerId === 'string' ? providerId : ''} model={typeof model === 'string' ? model : ''} config={config} onPatch={patch} />;
    }
    case 'gallery-image-picker':
      return <GalleryImagePickerField label={field.label} value={typeof value === 'string' ? value : ''} onChange={(next) => patch({ [field.key]: next })} />;
    case 'image-upload':
      return (
        <ImageUploadField
          label={field.label}
          value={asUploadValue(value, config)}
          onChange={(next) => patch({ [field.key]: next.base64, fileName: next.fileName, width: next.width, height: next.height, contentType: next.contentType })}
        />
      );
  }
}

/** Fields the inspector owns whole cannot be one run-form value (§1.4). */
const EXPOSABLE = new Set<ConfigField['kind']>(['text', 'prompt', 'number', 'select', 'gallery-image-picker', 'image-upload']);

/** The config key a param on this field locks (an upload exposes the path key). */
function lockKeyFor(field: ConfigField): string {
  return field.kind === 'image-upload' ? 'filePath' : field.key;
}

export function NodeInspector({ nodeId, toolId, config, doc, onPatchConfig, onExpose, onUnexpose, onSetPause }: Props) {
  const spec = useNodeSpec(toolId);
  if (!spec) return <div className="p-3 text-[11px] text-accent-red">Unknown node: {toolId}</div>;
  const unmet = spec.available === false ? (spec.needs ?? []) : [];
  const pause = doc?.graph.nodes.find((n) => n.id === nodeId)?.pause ?? false;

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full" data-node-inspector={nodeId}>
      <div>
        <h3 className="text-[13px] font-semibold text-text-primary">{spec.label}</h3>
        <p className="text-[11px] text-text-dim mt-0.5">{spec.description}</p>
        {unmet.length > 0 && (
          <p className="text-[11px] text-accent-amber mt-1 flex items-center gap-1">
            <AlertTriangle size={11} strokeWidth={2} />
            Needs {unmet.map(needLabel).join(', ')} — add one in AI → Providers.
          </p>
        )}
        {spec.priced && <p className="text-[11px] text-text-dim mt-1">Priced step{spec.priceHint ? `: ${spec.priceHint}` : ''}.</p>}
      </div>

      <PauseToggle pause={pause} onChange={onSetPause} />

      {spec.configSchema.length === 0 ? (
        <p className="text-[11px] text-text-dim">This node has no settings.</p>
      ) : (
        spec.configSchema.map((field) => {
          const exposable = EXPOSABLE.has(field.kind);
          const bound = doc && exposable ? boundParam(doc, nodeId, lockKeyFor(field)) : null;
          return (
            <div key={field.key + '-' + field.kind} className="flex flex-col gap-1" data-config-field={field.key}>
              {exposable && (
                <div className="flex items-center justify-end gap-1">
                  {bound && <Lock size={10} strokeWidth={2} className="text-text-dim" />}
                  <ExposeParamToggle bound={bound} onExpose={() => onExpose(field)} onUnexpose={() => onUnexpose(lockKeyFor(field))} />
                </div>
              )}
              <div className={bound ? 'opacity-50 pointer-events-none' : ''} title={bound ? 'Set on the run form' : undefined}>
                {renderField(field, config, onPatchConfig)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
