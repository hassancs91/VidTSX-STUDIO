import { useState } from 'react';
import { Button, TextInput } from '@shared/components';
import { Select } from '@shared/components/Select';
import type { LlmProviderConfig } from '@shared/ipc/types';

type Protocol = 'openai-compat' | 'anthropic-compat';

const PROTOCOL_OPTIONS: { value: Protocol; label: string }[] = [
  { value: 'openai-compat', label: 'OpenAI-compatible' },
  { value: 'anthropic-compat', label: 'Anthropic-compatible' },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'provider';
}

function uniqueId(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface CustomProviderFormProps {
  existingIds: string[];
  onAdd: (config: LlmProviderConfig) => void;
}

/**
 * Collapsible form to register any OpenAI/Anthropic-compatible endpoint as an
 * LLM provider (name + base URL + API key + protocol). Added entries behave
 * like presets: enable, test, pick per-job in the Creator.
 */
export function CustomProviderForm({ existingIds, onAdd }: CustomProviderFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('openai-compat');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setProtocol('openai-compat');
    setBaseURL('');
    setApiKey('');
    setDefaultModel('');
    setError(null);
  };

  const handleAdd = () => {
    if (!name.trim()) return setError('Name is required');
    if (!/^https?:\/\/.+/.test(baseURL.trim())) return setError('Base URL must start with http(s)://');
    if (!defaultModel.trim()) return setError('Default model is required');

    onAdd({
      id: uniqueId(`custom-${slugify(name.trim())}`, existingIds),
      name: name.trim(),
      type: protocol,
      authMode: 'api-key',
      apiKey: apiKey.trim() || undefined,
      baseURL: baseURL.trim().replace(/\/+$/, ''),
      defaultModel: defaultModel.trim(),
      enabled: true,
    });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="p-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <button
          onClick={() => setOpen(true)}
          className="text-[11px] text-accent hover:text-accent-light transition-colors cursor-pointer"
        >
          + Add custom provider
        </button>
        <div className="text-[10px] text-text-dim mt-0.5">
          Connect any OpenAI- or Anthropic-compatible endpoint.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="text-[12px] text-text-secondary font-medium mb-2">New custom provider</div>

      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Name</div>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groq, DeepSeek, my-vllm"
          className="w-full"
        />
      </div>

      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Protocol</div>
        <Select
          value={protocol}
          onChange={(next) => setProtocol(next as Protocol)}
          options={PROTOCOL_OPTIONS}
          className="w-full"
        />
      </div>

      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Base URL</div>
        <TextInput
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder={
            protocol === 'openai-compat'
              ? 'https://api.example.com/v1'
              : 'https://api.example.com'
          }
          className="w-full"
        />
      </div>

      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">API Key (optional for local servers)</div>
        <TextInput
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key..."
          className="w-full"
        />
      </div>

      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Default model</div>
        <TextInput
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="Model name..."
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={handleAdd}>
          Add
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        {error && <span className="text-[11px] text-accent-red">{error}</span>}
      </div>
    </div>
  );
}
