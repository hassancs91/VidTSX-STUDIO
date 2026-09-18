import type { ReactNode } from 'react';
import { PaneTabButton } from './PaneTabButton';

export type LeftTab = 'media' | 'shots' | 'captions' | 'transcript';
export const LEFT_TABS: readonly LeftTab[] = ['media', 'shots', 'captions', 'transcript'];

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
}

/**
 * The editor's left pane (video-10 feedback item 5): Media | Shots | Captions,
 * plus Transcript — beside the preview on purpose, because editing by text is
 * reading while watching. Media and Shots stay mounted and are hidden when
 * inactive, so an open import panel, a half-typed shot brief or a pending
 * remove confirm survive a tab switch (the item 4 lesson); Captions and
 * Transcript mount on demand.
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
}: Props) {
  // A remembered 'transcript' choice must not strand the pane when the flag is off.
  const active: LeftTab = tab === 'transcript' && !renderTranscript ? 'media' : tab;
  return (
    <div className="flex flex-col h-full bg-app-deep" data-left-pane>
      <div className="flex h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <PaneTabButton tabId="media" label="Media" count={mediaCount} isActive={active === 'media'} onClick={() => onTab('media')} />
        <PaneTabButton tabId="shots" label="Shots" count={shotCount} isActive={active === 'shots'} onClick={() => onTab('shots')} />
        <PaneTabButton tabId="captions" label="Captions" isActive={active === 'captions'} onClick={() => onTab('captions')} />
        {renderTranscript && (
          <PaneTabButton tabId="transcript" label="Transcript" isActive={active === 'transcript'} onClick={() => onTab('transcript')} />
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
      </div>
    </div>
  );
}
