import { useMemo } from 'react';
import { Button, Panel, SectionHeader } from '@shared/components';
import { useLlmProviders } from '@renderer/hooks/useLlmProviders';
import { useProviderKeys } from '@renderer/hooks/useProviderKeys';
import { useProviderKeyDrafts } from '../../hooks/useProviderKeyDrafts';
import { configuredProviderIds } from '../../services/catalog-groups';
import { CustomEndpointsSection } from './CustomEndpointsSection';
import { ModelCatalogSection } from './ModelCatalogSection';
import { ProviderDefaultsBar } from './ProviderDefaultsBar';
import { ProviderKeysTable } from './ProviderKeysTable';
import { SubscriptionsSection } from './SubscriptionsSection';

/**
 * The Providers section (docs/ai-models-redesign.md §3.2): API keys as one
 * table, subscriptions as a second, app defaults, then the model catalogs
 * accordion. One Save commits every unsaved key and LLM-row change; the
 * catalogs save themselves on each edit as before.
 */
export function ProvidersContent() {
  const keys = useProviderKeys();
  const llm = useLlmProviders();
  const drafts = useProviderKeyDrafts(keys, llm);

  const configured = useMemo(
    () => configuredProviderIds(keys.hasKeys, llm.providers),
    [keys.hasKeys, llm.providers],
  );

  if (keys.loading || llm.loading) {
    return (
      <Panel className="p-3">
        <div className="text-[12px] text-text-muted">Loading providers…</div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-providers-content>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[70ch]">
          <h3 className="text-[13px] font-medium text-text-primary">Providers</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Bring your own keys — entered once, used by every feature the provider powers. Keys are stored
            encrypted on this machine and sent only to the provider itself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {drafts.savedFlash && <span className="text-[11px] text-accent-green">Saved ✓</span>}
          {drafts.error && <span className="text-[11px] text-accent-red">{drafts.error}</span>}
          {drafts.dirty && !drafts.saving && <span className="text-[10px] text-text-dim">Unsaved changes</span>}
          <Button variant="primary" onClick={() => void drafts.save()} disabled={drafts.saving || !drafts.dirty}>
            {drafts.saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <section>
        <SectionHeader>API keys</SectionHeader>
        <ProviderKeysTable keys={keys} llm={llm} drafts={drafts} />
      </section>

      <section>
        <SectionHeader>Subscriptions</SectionHeader>
        <p className="-mt-2 mb-3 max-w-[70ch] text-[10px] text-text-dim">
          No API key — these run on an account you already pay for. The app detects the sign-in; it never signs in
          for you.
        </p>
        <SubscriptionsSection llm={llm} onLlmChange={drafts.updateLlm} />
      </section>

      <CustomEndpointsSection
        llm={llm}
        onLlmChange={drafts.updateLlm}
        onRemove={(id) => {
          llm.removeProvider(id);
          drafts.updateLlm(id, {});
        }}
      />

      <section>
        <SectionHeader>Defaults</SectionHeader>
        <ProviderDefaultsBar
          llm={llm}
          onActiveChange={(id) => {
            llm.setActiveProvider(id);
            drafts.updateLlm(id ?? '', {});
          }}
        />
      </section>

      <section>
        <SectionHeader>Model catalogs</SectionHeader>
        <ModelCatalogSection configuredIds={configured} />
      </section>
    </div>
  );
}
