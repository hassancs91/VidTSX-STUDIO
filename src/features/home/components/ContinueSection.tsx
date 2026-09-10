import { useMemo } from 'react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useProjectPosters } from '@renderer/hooks/useProjectPosters';
import type { HomeContinueItem, HomeSummary } from '../types';
import { mergeContinueItems } from '../services/home-format';
import { goToScreen, openAgentSession, openMotionProject, openStudioProject } from '../services/home-navigation';
import { useHomeBrands } from '../hooks/useHomeBrands';
import { ContinueCard } from './ContinueCard';
import { SectionRow } from './SectionRow';

interface Props {
  summary: HomeSummary | null;
}

const SEE_ALL: { label: string; screen: string }[] = [
  { label: 'Studio', screen: 'studio' },
  { label: 'TSX', screen: 'creator' },
  { label: 'Agents', screen: 'agents' },
];

function open(item: HomeContinueItem): void {
  switch (item.kind) {
    case 'studio':
      openStudioProject(item.projectId);
      return;
    case 'motion':
      openMotionProject(item.folderPath, item.versionPath);
      return;
    case 'session':
      openAgentSession(item.agentId, item.sessionId);
      return;
  }
}

/** Recent work across Studio, the Creator and the agents — eight cards,
 *  newest first, with "See all" into each screen. */
export function ContinueSection({ summary }: Props) {
  const items = useMemo(
    () => (summary ? mergeContinueItems(summary) : []),
    [summary],
  );
  // Posters are read for the Studio projects on the row only.
  const studioRows = useMemo(
    () =>
      items.flatMap((i) =>
        i.kind === 'studio'
          ? [{ id: i.projectId, updatedAt: i.updatedAt, ...(i.posterPath ? { posterPath: i.posterPath } : {}) }]
          : [],
      ),
    [items],
  );
  const { getPoster } = useProjectPosters(studioRows);
  const palettes = useHomeBrands();

  return (
    <section data-home-section="continue">
      <SectionRow title="Continue">
        {SEE_ALL.filter((s) => isFeatureEnabled(s.screen)).map((s) => (
          <button
            key={s.screen}
            onClick={() => goToScreen(s.screen)}
            data-home-see-all={s.screen}
            className="px-2 h-[22px] rounded-[6px] text-[11px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
          >
            {s.label}
          </button>
        ))}
      </SectionRow>
      {summary && items.length === 0 ? (
        <div className="text-[11px] text-text-dim px-0.5 py-3" data-home-continue-empty>
          Nothing recent yet. Pick a starting point below.
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
          data-home-continue-grid
        >
          {items.map((item) => (
            <ContinueCard
              key={item.key}
              item={item}
              posterSrc={
                item.kind === 'studio'
                  ? getPoster({ id: item.projectId, updatedAt: item.updatedAt, ...(item.posterPath ? { posterPath: item.posterPath } : {}) })
                  : null
              }
              palette={item.kind === 'studio' && item.brandId ? (palettes.get(item.brandId) ?? null) : null}
              onOpen={() => open(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
