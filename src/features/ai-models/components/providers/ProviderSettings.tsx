import { useState } from 'react';
import { Button, TextInput } from '@shared/components';
import { useLlmProviders } from '@renderer/hooks/useLlmProviders';
import type { LlmProviderConfig } from '@shared/ipc/types';

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

const EyeIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const LoadingSpinner = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="animate-spin">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

function ProviderCard({
  provider,
  onUpdate,
  onTest,
  testState,
}: {
  provider: LlmProviderConfig;
  onUpdate: (id: string, updates: Partial<LlmProviderConfig>) => void;
  onTest: (provider: LlmProviderConfig) => void;
  testState?: { testing: boolean; success?: boolean; responseText?: string; durationMs?: number; error?: string };
}) {
  const [showKey, setShowKey] = useState(false);
  const isSubscription = provider.authMode === 'subscription';
  const needsApiKey = provider.authMode === 'api-key';

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
          {isSubscription && (
            <span
              className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-[#085041] text-accent-green"
            >
              Subscription
            </span>
          )}
          {provider.type === 'anthropic-compat' && (
            <span
              className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-[#3C3489] text-[#AFA9EC]"
            >
              API
            </span>
          )}
          {provider.type === 'openai-compat' && (
            <span
              className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-[#1A7F64] text-[#6EE7B7]"
            >
              OpenAI
            </span>
          )}
          {provider.type === 'gemini' && (
            <span
              className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-[#1E40AF] text-[#93C5FD]"
            >
              Gemini
            </span>
          )}
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

      {/* API Key field */}
      {needsApiKey && (
        <div className="mb-2">
          <div className="text-[10px] text-text-dim mb-1">API Key</div>
          <div className="flex items-center gap-1">
            <TextInput
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey || ''}
              onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
              placeholder="Enter API key..."
              className="flex-1"
            />
            <button
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] text-text-muted hover:bg-app-hover transition-colors"
              onClick={() => setShowKey(!showKey)}
              type="button"
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
      )}

      {/* Model field */}
      <div className="mb-2">
        <div className="text-[10px] text-text-dim mb-1">Default model</div>
        <TextInput
          value={provider.defaultModel}
          onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
          placeholder="Model name..."
          className="w-full"
        />
      </div>

      {/* Test + result row */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onTest(provider)}
          disabled={
            testState?.testing ||
            !provider.enabled ||
            (needsApiKey && !provider.apiKey)
          }
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
                  OK
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

export function ProviderSettings() {
  const {
    providers,
    loading,
    saving,
    saveError,
    testStates,
    updateProvider,
    saveProviders,
    testProvider,
  } = useLlmProviders();

  if (loading) {
    return (
      <div className="bg-app-surface rounded-lg p-3 border border-border">
        <div className="text-[12px] text-text-muted">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      {providers
        .filter((p) => p.id === 'claude-subscription')
        .map((provider) => (
          <ProviderCard
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
