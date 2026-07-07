import { useState } from 'react';
import { useThumbnailTester } from '../../hooks/useThumbnailTester';
import type { LayoutMode } from '../../hooks/useThumbnailTester';
import { ImageDropZone } from './ImageDropZone';
import { YouTubeGrid } from './YouTubeGrid';
import { YouTubeSearchLayout } from './YouTubeSearchLayout';
import { YouTubeSidebarLayout } from './YouTubeSidebarLayout';
import { YouTubeLivePreview } from './YouTubeLivePreview';

interface ThumbnailTesterScreenProps {
  onBack: () => void;
}

type PreviewTab = 'simulated' | 'live';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'search', label: 'Search' },
  { value: 'sidebar', label: 'Sidebar' },
];

export function ThumbnailTesterScreen({ onBack }: ThumbnailTesterScreenProps) {
  const tester = useThumbnailTester();
  const [activeTab, setActiveTab] = useState<PreviewTab>('simulated');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 gap-2 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-[12px]">Tools</span>
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-[13px] font-medium text-text-secondary">
          YouTube Thumbnail Tester
        </span>

        {/* Tab switcher — right side of toolbar */}
        <div className="ml-auto flex items-center">
          <div
            className="flex rounded-[6px] overflow-hidden"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <button
              onClick={() => setActiveTab('simulated')}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'simulated'
                  ? 'bg-accent text-white'
                  : 'bg-app-surface text-text-muted hover:text-text-primary'
              }`}
            >
              Simulated
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'live'
                  ? 'bg-accent text-white'
                  : 'bg-app-surface text-text-muted hover:text-text-primary'
              }`}
            >
              <svg width="12" height="9" viewBox="0 0 90 65" fill="none">
                <rect width="90" height="65" rx="16" fill={activeTab === 'live' ? '#fff' : '#FF0000'} />
                <path d="M36 18V47L62 32.5L36 18Z" fill={activeTab === 'live' ? '#7F77DD' : 'white'} />
              </svg>
              Live YouTube
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Controls Panel — always visible */}
        <div
          className="w-[280px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4"
          style={{ borderRight: '0.5px solid var(--color-border)' }}
        >
          {/* Thumbnail Upload */}
          <ImageDropZone
            label="Thumbnail"
            imageDataUrl={tester.thumbnailDataUrl}
            aspectRatio="16/9"
            onDrop={tester.handleThumbnailDrop}
            onBrowse={tester.pickThumbnail}
            onClear={tester.clearThumbnail}
          />

          {/* Video Title */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-muted">Video Title</span>
            <textarea
              value={tester.videoTitle}
              onChange={(e) => tester.setVideoTitle(e.target.value)}
              placeholder="Enter your video title..."
              rows={2}
              className="w-full px-2.5 py-2 rounded-[6px] bg-app-surface text-[12px] text-text-primary placeholder:text-text-dim resize-none"
              style={{ border: '0.5px solid var(--color-border)' }}
            />
          </div>

          {/* Channel Avatar */}
          <div className="flex gap-3 items-end">
            <div className="w-[60px]">
              <ImageDropZone
                label="Channel Icon"
                imageDataUrl={tester.channelAvatarDataUrl}
                aspectRatio="1/1"
                onDrop={tester.handleAvatarDrop}
                onBrowse={tester.pickChannelAvatar}
                onClear={tester.clearAvatar}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <span className="text-[11px] text-text-muted">Channel Name</span>
              <input
                type="text"
                value={tester.channelName}
                onChange={(e) => tester.setChannelName(e.target.value)}
                placeholder="Your Channel"
                className="w-full px-2.5 py-1.5 rounded-[6px] bg-app-surface text-[12px] text-text-primary placeholder:text-text-dim"
                style={{ border: '0.5px solid var(--color-border)' }}
              />
            </div>
          </div>

          {/* Simulated-only controls */}
          {activeTab === 'simulated' && (
            <>
              {/* Layout Mode */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-text-muted">Layout</span>
                <div
                  className="flex rounded-[6px] overflow-hidden"
                  style={{ border: '0.5px solid var(--color-border)' }}
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => tester.setLayoutMode(opt.value)}
                      className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                        tester.layoutMode === opt.value
                          ? 'bg-accent text-white'
                          : 'bg-app-surface text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Randomize */}
              <button
                onClick={tester.randomizePosition}
                className="flex items-center justify-center gap-2 py-2 rounded-[6px] bg-accent text-white text-[12px] font-medium hover:bg-accent-light transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
                Randomize Position
              </button>

              {/* Highlight Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tester.highlightUserCard}
                  onChange={(e) => tester.setHighlightUserCard(e.target.checked)}
                  className="accent-accent"
                />
                <span className="text-[11px] text-text-muted">Highlight my card</span>
              </label>
            </>
          )}

          {/* Live YouTube tips */}
          {activeTab === 'live' && (
            <div
              className="flex flex-col gap-2 p-3 rounded-[6px]"
              style={{ backgroundColor: 'rgba(127,119,221,0.08)', border: '0.5px solid rgba(127,119,221,0.2)' }}
            >
              <span className="text-[11px] font-medium text-accent">How it works</span>
              <ul className="text-[10px] text-text-muted flex flex-col gap-1.5 pl-3" style={{ listStyleType: 'disc' }}>
                <li>YouTube loads in a real browser</li>
                <li>Wait for page to fully load</li>
                <li>Click <strong style={{ color: 'var(--color-text-primary)' }}>Inject Thumbnail</strong> to replace a video card with yours</li>
                <li>Use <strong style={{ color: 'var(--color-text-primary)' }}>Random Position</strong> to try different spots</li>
                <li>Scroll down on YouTube to load more cards, then inject again</li>
              </ul>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-w-0 min-h-0">
          {/* Simulated preview */}
          {activeTab === 'simulated' && (
            <div className="h-full overflow-auto" style={{ backgroundColor: '#0f0f0f' }}>
              {tester.layoutMode === 'home' && (
                <YouTubeGrid
                  competitors={tester.selectedCompetitors}
                  userCard={tester.userCard}
                  userCardIndex={tester.userCardIndex}
                  highlightUserCard={tester.highlightUserCard}
                />
              )}
              {tester.layoutMode === 'search' && (
                <YouTubeSearchLayout
                  competitors={tester.selectedCompetitors}
                  userCard={tester.userCard}
                  userCardIndex={tester.userCardIndex}
                  highlightUserCard={tester.highlightUserCard}
                />
              )}
              {tester.layoutMode === 'sidebar' && (
                <YouTubeSidebarLayout
                  competitors={tester.selectedCompetitors}
                  userCard={tester.userCard}
                  userCardIndex={tester.userCardIndex}
                  highlightUserCard={tester.highlightUserCard}
                />
              )}
            </div>
          )}

          {/* Live YouTube preview */}
          {activeTab === 'live' && (
            <YouTubeLivePreview userCard={tester.userCard} />
          )}
        </div>
      </div>
    </div>
  );
}
