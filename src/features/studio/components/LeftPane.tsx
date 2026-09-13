import type { ReactNode } from 'react';
import { PaneTabButton } from './PaneTabButton';

export type LeftTab = 'media' | 'shots' | 'captions';
export const LEFT_TABS: readonly LeftTab[] = ['media', 'shots', 'captions'];

interface Props {
  tab: LeftTab;
  onTab: (tab: LeftTab) => void;
  mediaCount: number;
  shotCount: number;
  media: ReactNode;
  shots: ReactNode;
  /** Rendered only while its tab is active (template cards load modules). */
  renderCaptions: () => ReactNode;
}

/**
 * The editor's left pane (video-10 feedback item 5): Media | Shots | Captions.
 * Media and Shots stay mounted and are hidden when inactive, so an open
 * import panel, a half-typed shot brief or a pending remove confirm survive a
 * tab switch (the item 4 lesson); Captions mounts on demand.
 */
export function LeftPane({ tab, onTab, mediaCount, shotCount, media, shots, renderCaptions }: Props) {
  return (
    <div className="flex flex-col h-full bg-app-deep" data-left-pane>
      <div className="flex h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <PaneTabButton tabId="media" label="Media" count={mediaCount} isActive={tab === 'media'} onClick={() => onTab('media')} />
        <PaneTabButton tabId="shots" label="Shots" count={shotCount} isActive={tab === 'shots'} onClick={() => onTab('shots')} />
        <PaneTabButton tabId="captions" label="Captions" isActive={tab === 'captions'} onClick={() => onTab('captions')} />
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="h-full" hidden={tab !== 'media'}>
          {media}
        </div>
        <div className="h-full" hidden={tab !== 'shots'}>
          {shots}
        </div>
        {tab === 'captions' && <div className="h-full">{renderCaptions()}</div>}
      </div>
    </div>
  );
}
