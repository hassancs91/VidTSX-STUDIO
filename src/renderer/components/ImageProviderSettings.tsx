import { Button, TextInput } from '@shared/components';
import { useImageProviders } from '../hooks/useImageProviders';
import type { ImageProviderLocal } from '../hooks/useImageProviders';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';

const MODELS_BY_TYPE: Record<string, ReadonlyArray<ImageModelCatalogEntry>> = {
  fal: [
    { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
    { id: 'nano-banana-2', name: 'Nano Banana 2' },
    { id: 'seedream-v4.5', name: 'SeedREAM v4.5' },
  ],
  openrouter: [
    { id: 'black-forest-labs/flux.2-pro', name: 'FLUX.2 Pro' },
    { id: 'black-forest-labs/flux.2-max', name: 'FLUX.2 Max' },
    { id: 'black-forest-labs/flux.2-flex', name: 'FLUX.2 Flex' },
  ],
};

const CheckIcon = () => (
  <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7L5.5 10.5L12 4" />
  </svg>
);

const XIcon = () => (
  <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3L11 11M11 3L3 11" />
  </svg>
);

const LoadingSpinner = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="animate-spin">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

function ImageProviderCard({
  provider,
  onUpdate,
  onTest,
  testState,
}: {
  provider: ImageProviderLocal;
  onUpdate: (id: string, updates: Partial<ImageProviderLocal>) => void;
  onTest: (providerId: string) => void;
  testState?: { testing: boolean; success?: boolean; saved?: boolean; durationMs?: number; error?: string };
}) {
  return (
    <div
      className={`p-3 ${provider.enabled ? '' : 'opacity-60'}`}
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      {/* Header row: name + toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-secondary font-medium">
            {provider.name}
          </span>
          <span className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-[#3C3489] text-[#AFA9EC]">
            API
          </span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-[10px] text-text-dim">
            {provider.enabled ? 'On' : 'Off'}
          </span>
          <div
            className={`relative w-[32px] h-[16px] rounded-full transition-colors duration-150 ${
              provider.enabled ? 'bg-accent' : 'bg-app-hover'
            }`}
            style={{ border: '0.5px solid var(--color-border)' }}
            onClick={() => onUpdate(provider.id, { enabled: !provider.enabled })}
          >
            <div
              className={`absolute top-[2px] w-[10px] h-[10px] rounded-full bg-white transition-all duration-150 ${
                provider.enabled ? 'left-[18px]' : 'left-[3px]'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Key status — keys live in the shared API Keys card above */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px]">
        {provider.hasApiKey ? (
          <>
            <span className="text-accent-green"><CheckIcon /></span>
            <span className="text-text-secondary">Uses your {provider.name} API key</span>
          </>
        ) : (
          <>
            <span className="text-accent-red"><XIcon /></span>
            <span className="text-text-secondary">Add the API key in the card above</span>
          </>
        )}
      </div>

      {/* Model selector */}
      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Default model</div>
        {MODELS_BY_TYPE[provider.type] ? (
          <select
            className="w-full bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
            value={provider.defaultModel}
            onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
          >
            {MODELS_BY_TYPE[provider.type].map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <TextInput
            value={provider.defaultModel}
            onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
            placeholder="Model name (e.g. black-forest-labs/flux.2-pro)"
            className="w-full"
          />
        )}
      </div>

      {/* Test + result row */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onTest(provider.id)}
          disabled={testState?.testing || !provider.enabled || !provider.hasApiKey}
        >
          {testState?.testing ? (
            <span className="flex items-center gap-1.5">
              <LoadingSpinner />
              Testing...
            </span>
          ) : (
            'Test Connection'
          )}
        </Button>

        {testState && !testState.testing && (
          <div className="flex items-center gap-1.5">
            {testState.success ? (
              <>
                <span className="text-accent-green"><CheckIcon /></span>
                <span className="text-[11px] text-accent-green">
                  {testState.saved ? 'Connected & saved' : 'Connected'}
                  {testState.durationMs !== undefined && (
                    <span className="text-text-dim ml-1">({testState.durationMs}ms)</span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="text-accent-red"><XIcon /></span>
                <span className="text-[11px] text-accent-red">
                  {testState.error || 'Failed'}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImageProviderSettings() {
  const {
    providers,
    loading,
    saving,
    saveError,
    testStates,
    updateProvider,
    saveProviders,
    testProvider,
  } = useImageProviders();

  if (loading) {
    return (
      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="text-[12px] text-text-muted">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      {providers.map((provider) => (
        <ImageProviderCard
          key={provider.id}
          provider={provider}
          onUpdate={updateProvider}
          onTest={testProvider}
          testState={testStates[provider.id]}
        />
      ))}

      {/* Save button */}
      <div className="p-3 flex items-center gap-2">
        <Button
          variant="primary"
          onClick={saveProviders}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {saveError && (
          <span className="text-[11px] text-accent-red">{saveError}</span>
        )}
      </div>
    </div>
  );
}
