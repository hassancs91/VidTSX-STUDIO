import { useState } from 'react';
import { ProviderSettings } from '../../ProviderSettings';
import { ImageProviderSettings } from '../../ImageProviderSettings';
import { AiUsageDashboard } from '../../AiUsageDashboard';
import { SectionHeader } from '../SectionHeader';
import { ApiKeysCard } from '../ApiKeysCard';

const PROVIDER_SUB_TABS = [
  { id: 'config' as const, label: 'Providers' },
  { id: 'usage' as const, label: 'Usage' },
];

type ProviderSubTabId = (typeof PROVIDER_SUB_TABS)[number]['id'];

export function ProvidersTab() {
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
              px-3 h-[26px] rounded-md text-[11px] font-medium transition-colors duration-150
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
          <ApiKeysCard />
          <div className="grid grid-cols-2 gap-6">
            <div>
              <SectionHeader>LLM Providers</SectionHeader>
              <ProviderSettings />
            </div>
            <div>
              <SectionHeader>Image Providers</SectionHeader>
              <ImageProviderSettings />
            </div>
          </div>
        </>
      )}

      {subTab === 'usage' && <AiUsageDashboard />}
    </div>
  );
}
