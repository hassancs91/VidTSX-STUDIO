import type { ReactNode } from 'react';
import { Blend, Captions, Clapperboard, Film, Palette, ScrollText, Sparkles } from 'lucide-react';
import { PaneTabButton } from './PaneTabButton';

export type LeftTab = 'media' | 'shots' | 'captions' | 'transcript' | 'transitions' | 'filters' | 'effects';
export const LEFT_TABS: readonly LeftTab[] = ['media', 'shots', 'captions', 'transcript', 'transitions', 'filters', 'effects'];

interface Props {
  tab: LeftTab;
  onTab: (tab: LeftTab) => void;
  mediaCount: number;
  shotCount: number;
  media: ReactNode;
  shots: ReactNode;
  /** Rendered only while its tab is active (template cards load modules). */
  renderCaptions: () => ReactNode;
  /** Text-based editing (flag `studio-text-edit`); no tab when absent. Rendered
   *  only while active — thousands of word nodes have no business in a hidden pane. */
  renderTranscript?: () => ReactNode;
  /** Rendered only while active, like Captions: its cards load modules and play. */
  renderTransitions: () => ReactNode;
  /** Per-clip filters and effects (flag `studio-filters`); no tabs when absent.
   *  Two galleries of one mechanism — Filters (colour looks) and Effects
   *  (stylized treatments) — each rendered only while active, like Transitions. */
  renderFilters?: () => ReactNode;
  renderEffects?: () => ReactNode;
}

/**
 * The editor's left pane (video-10 feedback item 5): Media | Shots | Captions,
 * plus Transcript — beside the preview on purpose, because editing by text is
 * reading while watching — Transitions, and Filters | Effects. Media and Shots
 * stay mounted and are hidden when inactive, so an open import panel, a
 * half-typed shot brief or a pending remove confirm survive a tab switch (the
 * item 4 lesson); the rest mount on demand. Seven tabs don't fit as text in a
 * 300 px pane, so each carries an icon (PaneTabButton) and inactive tabs
 * collapse to it.
 */
export function LeftPane({
  tab,
  onTab,
  mediaCount,
  shotCount,
  media,
  shots,
  renderCaptions,
  renderTranscript,
  renderTransitions,
  renderFilters,
  renderEffects,
}: Props) {
  // A remembered choice must not strand the pane when its flag is off.
  const gated =
    (tab === 'transcript' && !renderTranscript) ||
    (tab === 'filters' && !renderFilters) ||
    (tab === 'effects' && !renderEffects);
  const active: LeftTab = gated ? 'media' : tab;
  return (
    <div className="flex flex-col h-full bg-app-deep" data-left-pane>
      <div className="@container flex h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <PaneTabButton tabId="media" label="Media" icon={Film} count={mediaCount} isActive={active === 'media'} onClick={() => onTab('media')} />
        <PaneTabButton tabId="shots" label="Shots" icon={Clapperboard} count={shotCount} isActive={active === 'shots'} onClick={() => onTab('shots')} />
        <PaneTabButton tabId="captions" label="Captions" icon={Captions} isActive={active === 'captions'} onClick={() => onTab('captions')} />
        {renderTranscript && (
          <PaneTabButton tabId="transcript" label="Transcript" icon={ScrollText} isActive={active === 'transcript'} onClick={() => onTab('transcript')} />
        )}
        <PaneTabButton tabId="transitions" label="Transitions" icon={Blend} isActive={active === 'transitions'} onClick={() => onTab('transitions')} />
        {renderFilters && (
          <PaneTabButton tabId="filters" label="Filters" icon={Palette} isActive={active === 'filters'} onClick={() => onTab('filters')} />
        )}
        {renderEffects && (
          <PaneTabButton tabId="effects" label="Effects" icon={Sparkles} isActive={active === 'effects'} onClick={() => onTab('effects')} />
        )}
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="h-full" hidden={active !== 'media'}>
          {media}
        </div>
        <div className="h-full" hidden={active !== 'shots'}>
          {shots}
        </div>
        {active === 'captions' && <div className="h-full">{renderCaptions()}</div>}
        {active === 'transcript' && renderTranscript && <div className="h-full">{renderTranscript()}</div>}
        {active === 'transitions' && <div className="h-full">{renderTransitions()}</div>}
        {active === 'filters' && renderFilters && <div className="h-full">{renderFilters()}</div>}
        {active === 'effects' && renderEffects && <div className="h-full">{renderEffects()}</div>}
      </div>
    </div>
  );
}
