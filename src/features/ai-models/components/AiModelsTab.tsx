import { useState } from 'react';
import { SUB_TABS, type ModelSubTab } from '../types';
import { MainContent } from './MainContent';
import { AudioModelsContent } from './AudioModelsContent';
import { ImageModelsContent } from './ImageModelsContent';
import { LlmModelsContent } from './LlmModelsContent';
import { EmbeddingModelsContent } from './EmbeddingModelsContent';
import { ComingSoonPlaceholder } from './ComingSoonPlaceholder';

export function AiModelsTab() {
  const [activeSubTab, setActiveSubTab] = useState<ModelSubTab>('main');

  const activeLabel = SUB_TABS.find((t) => t.id === activeSubTab)?.label ?? '';

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 mb-4">
        {SUB_TABS.map((tab) => (
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
      {activeSubTab === 'audio' && <AudioModelsContent />}
      {activeSubTab === 'image' && <ImageModelsContent />}
      {activeSubTab === 'llms' && <LlmModelsContent />}
      {activeSubTab === 'embeddings' && <EmbeddingModelsContent />}
      {activeSubTab !== 'main' && activeSubTab !== 'audio' && activeSubTab !== 'image' && activeSubTab !== 'llms' && activeSubTab !== 'embeddings' && (
        <ComingSoonPlaceholder label={activeLabel} />
      )}
    </div>
  );
}
