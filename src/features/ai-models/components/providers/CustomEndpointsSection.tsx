import { Panel, SectionHeader } from '@shared/components';
import { isFeatureEnabled } from '@shared/feature-flags';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { LlmProvidersApi } from '../../hooks/useProviderKeyDrafts';
import { CustomProviderForm } from './CustomProviderForm';
import { LlmProviderRow, type LlmProviderTestState } from './LlmProviderRow';

const isCustomProvider = (id: string) => id.startsWith('custom-');

interface CustomEndpointsSectionProps {
  llm: LlmProvidersApi;
  onLlmChange: (id: string, updates: Partial<LlmProviderConfig>) => void;
  onRemove: (id: string) => void;
}

/**
 * OpenAI- / Anthropic-compatible endpoints the user added themselves. V1
 * ships one engine path, so the form that creates NEW ones is dev-flagged
 * (H5, `VITE_FF_CUSTOM_PROVIDER`); saved endpoints always render so they can
 * be edited or removed. Renders nothing when there is nothing to show.
 */
export function CustomEndpointsSection({ llm, onLlmChange, onRemove }: CustomEndpointsSectionProps) {
  const customs = llm.providers.filter((p) => isCustomProvider(p.id));
  const canAdd = isFeatureEnabled('custom-provider');
  if (customs.length === 0 && !canAdd) return null;

  return (
    <section>
      <SectionHeader>Custom endpoints</SectionHeader>
      <Panel>
        {customs.map((provider) => (
          <LlmProviderRow
            key={provider.id}
            provider={provider}
            isCustom
            testState={llm.testStates[provider.id] as LlmProviderTestState | undefined}
            onUpdate={onLlmChange}
            onTest={llm.testProvider}
            onRemove={onRemove}
          />
        ))}
        {canAdd && (
          <CustomProviderForm
            existingIds={llm.providers.map((p) => p.id)}
            onAdd={(config) => {
              llm.addProvider(config);
              onLlmChange(config.id, {});
            }}
          />
        )}
      </Panel>
    </section>
  );
}
