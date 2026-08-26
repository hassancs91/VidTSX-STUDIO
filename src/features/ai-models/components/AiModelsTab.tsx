import { useState } from 'react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { SUB_TABS, type ModelSubTab } from '../types';
import { MainContent } from './MainContent';
import { ProvidersContent } from './providers/ProvidersContent';
import { AudioTabContent } from './AudioTabContent';
import { ImageModelsContent } from './ImageModelsContent';
import { VideoModelsContent } from './VideoModelsContent';
import { LlmModelsContent } from './LlmModelsContent';
import { EmbeddingModelsContent } from './EmbeddingModelsContent';
import { ContentSafetyContent } from './ContentSafetyContent';
import { ComingSoonPlaceholder } from './ComingSoonPlaceholder';

const RENDERED_TABS = new Set<ModelSubTab>(['main', 'providers', 'audio', 'image', 'video', 'llms', 'embeddings', 'safety']);

// Sub-tabs gated behind a feature flag are removed from the tab bar entirely
// (not Coming-Soon placeholders) — enable via .env, see .env.example.
const TAB_FLAGS: Partial<Record<ModelSubTab, string>> = {
  video: 'ai-video-models',
  llms: 'ai-llm-models',
  '3d': 'ai-3d-models',
  embeddings: 'ai-embedding-models',
};

const VISIBLE_TABS = SUB_TABS.filter((tab) => {
  const flag = TAB_FLAGS[tab.id];
  return flag === undefined || isFeatureEnabled(flag);
});

export function AiModelsTab() {
  const [activeSubTab, setActiveSubTab] = useState<ModelSubTab>('main');

  const activeLabel = SUB_TABS.find((t) => t.id === activeSubTab)?.label ?? '';

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 mb-4">
        {VISIBLE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`
              px-2.5 h-[26px] rounded text-[11px] font-medium transition-colors duration-150
              ${
                activeSubTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'main' && <MainContent />}
      {activeSubTab === 'providers' && <ProvidersContent />}
      {activeSubTab === 'audio' && <AudioTabContent />}
      {activeSubTab === 'image' && <ImageModelsContent />}
      {activeSubTab === 'video' && <VideoModelsContent />}
      {activeSubTab === 'llms' && <LlmModelsContent />}
      {activeSubTab === 'embeddings' && <EmbeddingModelsContent />}
      {activeSubTab === 'safety' && <ContentSafetyContent />}
      {!RENDERED_TABS.has(activeSubTab) && (
        <ComingSoonPlaceholder label={activeLabel} />
      )}
    </div>
  );
}
