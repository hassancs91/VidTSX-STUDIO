import { useState } from 'react';
import { AiUsageDashboard } from './AiUsageDashboard';
import { ApiKeysSection } from './ApiKeysSection';
import { ModelCatalogSection } from './ModelCatalogSection';

const PROVIDER_SUB_TABS = [
  { id: 'config' as const, label: 'Providers' },
  { id: 'usage' as const, label: 'Usage' },
];

type ProviderSubTabId = (typeof PROVIDER_SUB_TABS)[number]['id'];

/**
 * Providers tab: one unified list for API keys / provider config (a key powers
 * every capability of its provider), plus editable per-provider model
 * catalogs. Usage dashboard on its own inner tab.
 */
export function ProvidersContent() {
  const [subTab, setSubTab] = useState<ProviderSubTabId>('config');

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 mb-4">
        {PROVIDER_SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`
              px-2.5 h-[26px] rounded text-[11px] font-medium transition-colors duration-150
              ${subTab === tab.id
                ? 'bg-app-active text-accent-light'
                : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'config' && (
        <>
          <ApiKeysSection />
          <ModelCatalogSection />
        </>
      )}

      {subTab === 'usage' && <AiUsageDashboard />}
    </div>
  );
}
