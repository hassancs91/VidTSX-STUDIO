import { Panel } from '@shared/components';
import { PROVIDER_REGISTRY, isProviderKeyId } from '@shared/providers/registry';
import type { LlmProvidersApi, ProviderKeyDrafts, ProviderKeysApi } from '../../hooks/useProviderKeyDrafts';
import { LlmKeyRow } from './LlmKeyRow';
import type { LlmProviderTestState } from './LlmProviderRow';
import { ProviderGridHeader } from './ProviderGridRow';
import { ProviderKeyRow } from './ProviderKeyRow';

const isCustomProvider = (id: string) => id.startsWith('custom-');

interface ProviderKeysTableProps {
  keys: ProviderKeysApi;
  llm: LlmProvidersApi;
  drafts: ProviderKeyDrafts;
}

/**
 * The API keys table: every shared bring-your-own-key provider (registry
 * order — one key powers every capability of its provider), then the LLM
 * providers that carry a key on their own entry (Claude with an API key, and
 * grandfathered presets whose key is already saved).
 */
export function ProviderKeysTable({ keys, llm, drafts }: ProviderKeysTableProps) {
  // Z.AI is cut from V1 (llm-preset-visibility): its key row hides with the
  // preset. Grandfathering matches H2/H5 — an install with a zai key already
  // saved keeps the row so the key can be changed / removed, and the H4 dev
  // flag restores it along with the presets.
  const allProvidersFlag =
    import.meta.env.VITE_FF_ALL_PROVIDERS === '1' || import.meta.env.VITE_FF_ALL_PROVIDERS === 'true';
  const sharedRows = PROVIDER_REGISTRY.filter((row) => row.id !== 'zai' || keys.hasKeys.zai || allProvidersFlag);

  // Own-key LLM providers: api-key auth, not a shared credential, not a custom endpoint.
  const llmKeyRows = llm.providers.filter(
    (p) => p.authMode === 'api-key' && !isProviderKeyId(p.id) && !isCustomProvider(p.id),
  );
  const offeredIds = new Set(llm.presets.map((p) => p.id));

  return (
    <Panel>
      <ProviderGridHeader detailLabel="API key" />
      {sharedRows.map((row) => {
        const draft = drafts.drafts[row.id] ?? '';
        const clearing = drafts.clearing.includes(row.id);
        const saved = keys.hasKeys[row.id] && !clearing;
        const accountIdValue = drafts.accountIdDraft ?? keys.cloudflareAccountId;
        const missingAccountId = row.extraField?.key === 'cloudflareAccountId' && !accountIdValue.trim();
        return (
          <ProviderKeyRow
            key={row.id}
            row={row}
            saved={saved}
            draft={draft}
            clearing={clearing}
            visible={!!drafts.visible[row.id]}
            onDraft={(value) => drafts.setDraft(row.id, value)}
            onToggleVisible={() => drafts.toggleVisible(row.id)}
            onClear={() => drafts.markClearing(row.id)}
            test={
              row.test === 'image' || row.test === 'video'
                ? {
                    state: drafts.tests[row.id],
                    disabled: (!saved && !draft.trim()) || missingAccountId,
                    onTest: () => void drafts.test(row.id, row.test === 'video' ? 'video' : 'image'),
                  }
                : undefined
            }
            extraField={
              row.extraField
                ? {
                    value: accountIdValue,
                    hint: row.extraField.hint,
                    placeholder: row.extraField.placeholder,
                    onChange: drafts.setAccountIdDraft,
                  }
                : undefined
            }
          />
        );
      })}
      {llmKeyRows.map((provider) => (
        <LlmKeyRow
          key={provider.id}
          provider={provider}
          legacy={!offeredIds.has(provider.id)}
          testState={llm.testStates[provider.id] as LlmProviderTestState | undefined}
          onUpdate={drafts.updateLlm}
          onTest={llm.testProvider}
        />
      ))}
    </Panel>
  );
}
