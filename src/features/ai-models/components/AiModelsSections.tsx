import { useEffect, useMemo, useState } from 'react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { AI_SECTIONS, DEFAULT_AI_SECTION, isAiSectionId, type AiSectionId } from '../types';
import { AiSectionRail } from './AiSectionRail';
import { OverviewContent } from './overview/OverviewContent';
import { ProvidersContent } from './providers/ProvidersContent';
import { AiUsageDashboard } from './providers/AiUsageDashboard';
import { AudioTabContent } from './AudioTabContent';
import { ImageModelsContent } from './ImageModelsContent';
import { VideoModelsContent } from './VideoModelsContent';
import { LlmModelsContent } from './LlmModelsContent';
import { EmbeddingModelsContent } from './EmbeddingModelsContent';
import { ContentSafetyContent } from './ContentSafetyContent';
import { ThreeDModelsContent } from './ThreeDModelsContent';

interface NavigateDetail {
  screen?: string;
  section?: string;
}

/**
 * Rail + content of the AI Models screen. Only the active section is mounted
 * (the previous tab bar's behaviour; sections re-read their state on mount).
 *
 * Deep links: any screen can land on a section by dispatching the app's
 * `vidtsx:navigate` event with `{ screen: 'ai-models', section: 'providers' }`
 * — App.tsx switches the screen, this component picks the section.
 */
export function AiModelsSections() {
  const [active, setActive] = useState<AiSectionId>(DEFAULT_AI_SECTION);
  const sections = useMemo(
    () => AI_SECTIONS.filter((s) => s.flag === undefined || isFeatureEnabled(s.flag)),
    [],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NavigateDetail>).detail;
      if (detail?.screen !== 'ai-models' || !isAiSectionId(detail.section)) return;
      const target = detail.section;
      if (sections.some((s) => s.id === target)) setActive(target);
    };
    window.addEventListener('vidtsx:navigate', handler);
    return () => window.removeEventListener('vidtsx:navigate', handler);
  }, [sections]);

  return (
    <div className="flex h-full min-h-0">
      <AiSectionRail sections={sections} active={active} onSelect={setActive} />
      <div className="min-w-0 flex-1 overflow-auto p-4" data-ai-section-content={active}>
        {active === 'overview' && <OverviewContent />}
        {active === 'providers' && <ProvidersContent />}
        {active === 'usage' && <AiUsageDashboard />}
        {active === 'image' && <ImageModelsContent />}
        {active === 'video' && <VideoModelsContent />}
        {active === 'audio' && <AudioTabContent />}
        {active === '3d' && <ThreeDModelsContent />}
        {active === 'llms' && <LlmModelsContent />}
        {active === 'embeddings' && <EmbeddingModelsContent />}
        {active === 'safety' && <ContentSafetyContent />}
      </div>
    </div>
  );
}
