import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button, StatusBadge, TextInput } from '@shared/components';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { CapabilityBadge } from './CapabilityBadge';
import { EnabledToggle } from './EnabledToggle';
import type { LlmProviderTestState } from './LlmProviderRow';
import { ProviderGridRow } from './ProviderGridRow';

interface LlmKeyRowProps {
  provider: LlmProviderConfig;
  /** No longer offered as a preset — the saved key keeps working (the H2 rule). */
  legacy: boolean;
  testState?: LlmProviderTestState;
  onUpdate: (id: string, updates: Partial<LlmProviderConfig>) => void;
  onTest: (provider: LlmProviderConfig) => void;
}

/**
 * An LLM provider whose key lives on its own provider entry (Claude with an
 * API key, and any grandfathered preset such as a saved Kimi or MiniMax
 * config). Same columns as the shared-key rows; the default model and the
 * connection test sit behind Configure.
 */
export function LlmKeyRow({ provider, legacy, testState, onUpdate, onTest }: LlmKeyRowProps) {
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasKey = !!provider.apiKey;

  return (
    <ProviderGridRow
      rowId={provider.id}
      muted={!provider.enabled}
      name={
        <>
          <span className="truncate text-[12px] font-medium text-text-secondary">{provider.name}</span>
          <EnabledToggle
            on={provider.enabled}
            onToggle={() => onUpdate(provider.id, { enabled: !provider.enabled })}
            showLabel={false}
            title={provider.enabled ? 'Enabled' : 'Disabled'}
          />
        </>
      }
      powers={
        <>
          <CapabilityBadge label="LLMs" />
          {legacy && (
            <StatusBadge tone="neutral" title="Not offered to new setups in this version; your saved key keeps working">
              Legacy
            </StatusBadge>
          )}
        </>
      }
      status={hasKey ? <StatusBadge tone="success">Key saved</StatusBadge> : <StatusBadge tone="neutral">No key</StatusBadge>}
      detail={
        <div className="flex items-center gap-1">
          <TextInput
            type={showKey ? 'text' : 'password'}
            value={provider.apiKey || ''}
            onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
            placeholder="Enter API key…"
            className="flex-1"
            aria-label={`${provider.name} API key`}
          />
          <button
            type="button"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-app-hover"
            onClick={() => setShowKey((v) => !v)}
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
          </button>
        </div>
      }
      actions={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="cursor-pointer text-[10px] text-text-dim transition-colors hover:text-text-secondary"
        >
          {expanded ? 'Hide' : 'Configure'}
        </button>
      }
      below={
        expanded ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-[10px] text-text-dim">Default model</span>
              <TextInput
                value={provider.defaultModel}
                onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
                placeholder="Model id…"
                className="w-full"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => onTest(provider)}
                disabled={testState?.testing || !provider.enabled || !hasKey}
              >
                {testState?.testing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    Testing…
                  </span>
                ) : (
                  'Test connection'
                )}
              </Button>
              {testState && !testState.testing && (
                <span className={`flex items-center gap-1 text-[11px] ${testState.success ? 'text-accent-green' : 'text-accent-red'}`}>
                  {testState.success ? <Check size={12} strokeWidth={2} /> : <X size={12} strokeWidth={2} />}
                  {testState.success
                    ? `OK${testState.durationMs !== undefined ? ` (${testState.durationMs} ms)` : ''}`
                    : testState.error || 'Failed'}
                </span>
              )}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}
