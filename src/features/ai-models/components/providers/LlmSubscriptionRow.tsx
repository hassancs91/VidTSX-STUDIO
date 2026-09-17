import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button, StatusBadge, TextInput } from '@shared/components';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { CapabilityBadge } from './CapabilityBadge';
import { EnabledToggle } from './EnabledToggle';
import type { LlmProviderTestState } from './LlmProviderRow';
import { ProviderGridRow } from './ProviderGridRow';

interface LlmSubscriptionRowProps {
  provider: LlmProviderConfig;
  testState?: LlmProviderTestState;
  onUpdate: (id: string, updates: Partial<LlmProviderConfig>) => void;
  onTest: (provider: LlmProviderConfig) => void;
}

/**
 * Claude on a subscription: no key to enter — the Agent SDK uses the Claude
 * Code sign-in on this machine. The row carries the enable switch, one line
 * of explanation, and the default model + connection test behind Configure.
 */
export function LlmSubscriptionRow({ provider, testState, onUpdate, onTest }: LlmSubscriptionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const result = testState && !testState.testing ? testState : undefined;

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
      powers={<CapabilityBadge label="LLMs" />}
      status={
        result ? (
          <StatusBadge tone={result.success ? 'success' : 'error'} title={result.success ? undefined : result.error}>
            {result.success ? 'Connected' : 'Failed'}
          </StatusBadge>
        ) : provider.enabled ? (
          <StatusBadge tone="success">On</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Off</StatusBadge>
        )
      }
      detail={
        <div className="text-[11px] leading-snug text-text-muted">
          Uses the Claude Code sign-in on this machine — nothing to enter. Run <code className="text-text-primary">claude</code> once in a
          terminal if you have not signed in yet.
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
              <Button variant="secondary" onClick={() => onTest(provider)} disabled={testState?.testing || !provider.enabled}>
                {testState?.testing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    Testing…
                  </span>
                ) : (
                  'Test connection'
                )}
              </Button>
              {result && (
                <span className={`flex items-center gap-1 text-[11px] ${result.success ? 'text-accent-green' : 'text-accent-red'}`}>
                  {result.success ? <Check size={12} strokeWidth={2} /> : <X size={12} strokeWidth={2} />}
                  {result.success ? `OK${result.durationMs !== undefined ? ` (${result.durationMs} ms)` : ''}` : result.error || 'Failed'}
                </span>
              )}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}
