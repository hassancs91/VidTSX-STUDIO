import { useState } from 'react';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Button, StatusBadge, TextInput } from '@shared/components';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { CapabilityBadge } from './CapabilityBadge';
import { EnabledToggle } from './EnabledToggle';

export interface LlmProviderTestState {
  testing: boolean;
  success?: boolean;
  durationMs?: number;
  error?: string;
}

export interface LlmProviderRowProps {
  provider: LlmProviderConfig;
  isCustom: boolean;
  testState?: LlmProviderTestState;
  onUpdate: (id: string, updates: Partial<LlmProviderConfig>) => void;
  onTest: (provider: LlmProviderConfig) => void;
  onRemove?: (id: string) => void;
}

/**
 * One LLM provider row in the unified Providers list: enable toggle, API key
 * (except subscription auth), default model, test. Custom endpoints add a
 * base-URL field and a remove button.
 */
export function LlmProviderRow({ provider, isCustom, testState, onUpdate, onTest, onRemove }: LlmProviderRowProps) {
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isSubscription = provider.authMode === 'subscription';
  const needsApiKey = provider.authMode === 'api-key';
  const hasKey = !!provider.apiKey;

  return (
    <div className={`p-3 ${provider.enabled ? '' : 'opacity-60'}`} style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      {/* Summary row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] text-text-secondary font-medium truncate">{provider.name}</span>
          <CapabilityBadge label="LLMs" />
          {isSubscription && <StatusBadge tone="success">Subscription</StatusBadge>}
          {isCustom && <StatusBadge tone="warn">Custom</StatusBadge>}
          {needsApiKey && hasKey && !expanded && (
            <StatusBadge tone="success">Key saved</StatusBadge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-text-dim hover:text-text-secondary transition-colors cursor-pointer"
            type="button"
          >
            {expanded ? 'Hide' : 'Configure'}
          </button>
          {isCustom && onRemove && (
            <button
              onClick={() => onRemove(provider.id)}
              className="flex items-center justify-center w-[20px] h-[20px] rounded-[4px] text-text-dim hover:text-accent-red hover:bg-app-hover transition-colors"
              title="Remove provider"
              type="button"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
          <EnabledToggle on={provider.enabled} onToggle={() => onUpdate(provider.id, { enabled: !provider.enabled })} />
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="mt-2">
          {isCustom && (
            <div className="mb-2">
              <div className="text-[10px] text-text-dim mb-1">
                Base URL
                <span className="ml-1.5 opacity-70">
                  ({provider.type === 'openai-compat' ? 'OpenAI' : 'Anthropic'}-compatible)
                </span>
              </div>
              <TextInput
                value={provider.baseURL || ''}
                onChange={(e) => onUpdate(provider.id, { baseURL: e.target.value })}
                placeholder="https://..."
                className="w-full"
              />
            </div>
          )}

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
                  {showKey ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                </button>
              </div>
            </div>
          )}

          <div className="mb-2">
            <div className="text-[10px] text-text-dim mb-1">Default model</div>
            <TextInput
              value={provider.defaultModel}
              onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
              placeholder="Model name..."
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => onTest(provider)}
              disabled={testState?.testing || !provider.enabled || (needsApiKey && !provider.apiKey)}
            >
              {testState?.testing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </Button>
            {testState && !testState.testing && (
              <span className={`flex items-center gap-1 text-[11px] ${testState.success ? 'text-accent-green' : 'text-accent-red'}`}>
                {testState.success ? <Check size={12} strokeWidth={2} /> : <X size={12} strokeWidth={2} />}
                {testState.success
                  ? `OK${testState.durationMs !== undefined ? ` (${testState.durationMs}ms)` : ''}`
                  : testState.error || 'Failed'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
