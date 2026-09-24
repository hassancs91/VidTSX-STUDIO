// The Filters tab and the Effects tab (docs/studio/FILTER_PACKS_DESIGN.md
// "UI") — one panel, mounted once per category. The selected clips up top —
// what they carry in this slot, and Remove — and below it a gallery of every
// installed item of the category, grouped by pack, each card painted live by
// the real filter. A card click applies to the selected video and image
// clips (one undo step, the slot rule); with none selected the panel says so.

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { FilterCategory, StudioClip, StudioTimeline } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import { useFilterDefinitions, type FilterList } from '../hooks/useFilters';
import { isEffectClipKind } from '../services/effect-ops';
import { EFFECT_WARNING_TEXT } from '../services/filter-status';
import { findClip } from '../services/timeline-ops';
import { FilterCard } from './FilterCard';

interface Props {
  category: FilterCategory;
  list: FilterList;
  timeline: StudioTimeline;
  selectedClipIds: readonly string[];
  dispatch: Dispatch<TimelineAction>;
}

const WORDS: Record<FilterCategory, { one: string; many: string; title: string }> = {
  filter: { one: 'filter', many: 'Filters', title: 'Filters' },
  effect: { one: 'effect', many: 'Effects', title: 'Effects' },
};

/** Installed items of one category grouped by pack, in list order (built-ins scan first). */
function groupByPack(items: readonly StudioFilterInfo[]) {
  const groups = new Map<string, { name: string; items: StudioFilterInfo[] }>();
  for (const item of items) {
    const group = groups.get(item.packId) ?? { name: item.packName, items: [] };
    group.items.push(item);
    groups.set(item.packId, group);
  }
  return [...groups.entries()].map(([packId, group]) => ({ packId, ...group }));
}

export function FiltersPanel({ category, list, timeline, selectedClipIds, dispatch }: Props) {
  const { filters, installed, loading, refresh } = list;
  const words = WORDS[category];
  // Every open re-scans the pack roots: a folder-dropped pack appears here.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const items = useMemo(() => filters.filter((f) => f.category === category), [filters, category]);
  const groups = useMemo(() => groupByPack(items), [items]);
  const categories = useMemo(() => Object.fromEntries(filters.map((f) => [f.kind, f.category])), [filters]);

  // The target: the selected clips a filter can apply to.
  const eligible = useMemo(
    () =>
      selectedClipIds
        .map((id) => findClip(timeline, id))
        .filter((found): found is NonNullable<typeof found> => found !== null && !found.track.locked && isEffectClipKind(found.clip.kind))
        .map((found) => found.clip),
    [selectedClipIds, timeline],
  );
  const eligibleIds = useMemo(() => eligible.map((c) => c.id), [eligible]);
  // What the target carries in this slot: one kind, or mixed, or nothing.
  const slotOf = (clip: StudioClip) => clip.effects?.find((e) => installed?.get(e.kind)?.category === category) ?? null;
  const slots = eligible.map(slotOf);
  const kinds = new Set(slots.map((e) => e?.kind ?? ''));
  const currentKind = kinds.size === 1 ? [...kinds][0] || null : null;
  const mixed = kinds.size > 1;
  const current = currentKind ? installed?.get(currentKind) ?? null : null;
  const missing = eligible.flatMap((clip) => (clip.effects ?? []).filter((e) => installed && !installed.has(e.kind)));

  const blockedReason = eligible.length === 0 ? 'Select a video or image clip on the timeline first.' : null;

  // Modules load as their cards scroll into view.
  const [visible, setVisible] = useState<string[]>([]);
  const onVisible = useCallback((kind: string) => setVisible((prev) => (prev.includes(kind) ? prev : [...prev, kind])), []);
  const definitions = useFilterDefinitions(visible, installed);

  const apply = (kind: string) => dispatch({ type: 'clip-effect-set', clipIds: eligibleIds, kind, category, categories });
  const remove = () => {
    if (currentKind) dispatch({ type: 'clip-effect-remove', clipIds: eligibleIds, kind: currentKind });
  };
  // "Apply to all clips on this track": the one selected clip's slot, to every eligible clip on its track.
  const track = eligible.length === 1 ? findClip(timeline, eligible[0].id)?.track : undefined;
  const trackIds = track ? track.clips.filter((c) => isEffectClipKind(c.kind)).map((c) => c.id) : [];
  const applyToTrack = () => {
    if (currentKind && trackIds.length > 1) dispatch({ type: 'clip-effect-set', clipIds: trackIds, kind: currentKind, category, categories });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-filters-panel={category}>
      <Section title="Selected clips">
        {eligible.length === 0 ? (
          <div className="text-[10px] text-text-dim leading-relaxed" data-filter-target="">
            {blockedReason} Then click a {words.one} below.
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-filter-target={eligibleIds.join(',')}>
            <div className="text-[10px] text-text-muted leading-relaxed">
              {eligible.length === 1 ? '1 clip' : `${eligible.length} clips`}
              {mixed ? (
                <span className="text-text-dim"> · mixed {words.many.toLowerCase()}</span>
              ) : current ? (
                <>
                  <span className="text-text-dim"> · </span>
                  <span className="text-text-secondary" data-filter-current={current.kind}>
                    {current.name}
                  </span>
                </>
              ) : currentKind ? (
                <span className="text-accent-amber" data-filter-current={currentKind}>
                  {' '}
                  · {currentKind}
                </span>
              ) : (
                <span className="text-text-dim"> · no {words.one}</span>
              )}
            </div>
            {(current || mixed || currentKind) && (
              <div className="flex items-center gap-1.5">
                {currentKind && trackIds.length > 1 && (
                  <Button variant="secondary" size="sm" className="h-[26px]" onClick={applyToTrack} data-filter-apply-track>
                    Apply to all clips on this track
                  </Button>
                )}
                {currentKind && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-[26px] flex items-center"
                    onClick={remove}
                    title={`Remove the ${words.one}`}
                    data-filter-remove
                  >
                    <Trash2 size={12} strokeWidth={1.75} />
                  </Button>
                )}
              </div>
            )}
            {missing.length > 0 && (
              <div className="flex gap-1.5 text-[10px] leading-relaxed text-accent-amber" data-filter-warning="not-installed">
                <TriangleAlert size={12} strokeWidth={1.75} className="shrink-0 mt-[1px]" />
                <span>{EFFECT_WARNING_TEXT['not-installed']}</span>
              </div>
            )}
            <div className="text-[10px] text-text-dim leading-relaxed">
              One {words.one} per clip: clicking another replaces it. Its intensity and knobs are in the Inspector.
            </div>
          </div>
        )}
      </Section>

      {loading && filters.length === 0 ? (
        <Section title={words.title}>
          <div className="text-[10px] text-text-dim">Loading {words.many.toLowerCase()}…</div>
        </Section>
      ) : groups.length === 0 ? (
        <Section title={words.title}>
          <div className="text-[10px] text-text-dim leading-relaxed">
            No {words.many.toLowerCase()} installed. Drop a pack folder into the assets root’s <code>packs/</code> folder to add
            some.
          </div>
        </Section>
      ) : (
        groups.map((group) => (
          <Section key={group.packId} title={group.name}>
            <div className="grid grid-cols-2 gap-1.5" data-filter-pack={group.packId}>
              {group.items.map((item) => (
                <FilterCard
                  key={item.kind}
                  kind={item.kind}
                  name={item.name}
                  {...(item.tagline ? { tagline: item.tagline } : {})}
                  {...(item.description ? { description: item.description } : {})}
                  animated={item.animated}
                  heavy={item.heavy}
                  definition={definitions?.[item.kind]}
                  active={currentKind === item.kind}
                  blockedReason={blockedReason}
                  onVisible={onVisible}
                  onPick={apply}
                />
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-2.5" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="text-[11px] font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
