import { VideoCard } from './VideoCard';
import { YouTubeHeader } from './YouTubeHeader';
import type { SampleVideoCard } from '../../data/thumbnail-tester-samples';
import type { UserCardData } from '../../hooks/useThumbnailTester';

interface YouTubeSidebarLayoutProps {
  competitors: SampleVideoCard[];
  userCard: UserCardData;
  userCardIndex: number;
  highlightUserCard: boolean;
}

export function YouTubeSidebarLayout({ competitors, userCard, userCardIndex, highlightUserCard }: YouTubeSidebarLayoutProps) {
  const cards: React.ReactNode[] = [];

  let competitorIdx = 0;
  const totalCards = competitors.length + 1;

  for (let i = 0; i < totalCards; i++) {
    if (i === userCardIndex) {
      cards.push(
        <VideoCard
          key="user"
          thumbnail={userCard.thumbnailDataUrl}
          title={userCard.videoTitle}
          channelName={userCard.channelName}
          channelAvatar={userCard.channelAvatarDataUrl}
          views="0 views"
          timeAgo="just now"
          duration="10:00"
          layout="sidebar"
          isHighlighted={highlightUserCard}
        />,
      );
    } else {
      const comp = competitors[competitorIdx];
      if (comp) {
        cards.push(
          <VideoCard
            key={comp.id}
            thumbnail={null}
            thumbnailGradient={comp.thumbnailGradient}
            title={comp.title}
            channelName={comp.channelName}
            channelAvatar={null}
            avatarColor={comp.avatarColor}
            views={comp.views}
            timeAgo={comp.timeAgo}
            duration={comp.duration}
            layout="sidebar"
          />,
        );
      }
      competitorIdx++;
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: '#0f0f0f', fontFamily: 'Roboto, Arial, sans-serif' }}>
      <YouTubeHeader />
      {/* Watch page layout */}
      <div className="flex flex-1 px-6 pt-6 pb-8 gap-6">
        {/* Main video area (placeholder) */}
        <div className="flex-1 min-w-0">
          {/* Fake video player */}
          <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
            <div className="w-full h-full flex items-center justify-center">
              <svg width="68" height="48" viewBox="0 0 68 48" fill="none" style={{ opacity: 0.3 }}>
                <rect width="68" height="48" rx="12" fill="#272727" />
                <path d="M28 16V32L44 24L28 16Z" fill="#717171" />
              </svg>
            </div>
          </div>
          {/* Fake video title under player */}
          <p
            className="mt-3"
            style={{ color: '#f1f1f1', fontSize: '20px', fontWeight: 700, fontFamily: 'Roboto, Arial, sans-serif', lineHeight: '28px' }}
          >
            Currently watching a video...
          </p>
          {/* Fake channel bar */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-[40px] h-[40px] rounded-full" style={{ backgroundColor: '#3a3a3a' }} />
            <div className="flex flex-col">
              <span style={{ color: '#f1f1f1', fontSize: '14px', fontWeight: 500, fontFamily: 'Roboto, Arial, sans-serif' }}>
                Some Channel
              </span>
              <span style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: 'Roboto, Arial, sans-serif' }}>
                1.2M subscribers
              </span>
            </div>
            <div
              className="ml-4 px-4 py-[8px] rounded-full"
              style={{ backgroundColor: '#f1f1f1', cursor: 'default' }}
            >
              <span style={{ color: '#0f0f0f', fontSize: '14px', fontWeight: 500, fontFamily: 'Roboto, Arial, sans-serif' }}>
                Subscribe
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar — "Up next" */}
        <div className="w-[402px] shrink-0">
          {/* Category chips for sidebar */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            {['All', 'Related', 'Recently uploaded', 'Watched'].map((c, i) => (
              <span
                key={c}
                className="shrink-0 px-3 py-[4px] rounded-lg text-[12px]"
                style={{
                  fontFamily: 'Roboto, Arial, sans-serif',
                  fontWeight: 500,
                  backgroundColor: i === 0 ? '#f1f1f1' : '#272727',
                  color: i === 0 ? '#0f0f0f' : '#f1f1f1',
                  cursor: 'default',
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-[8px]">
            {cards}
          </div>
        </div>
      </div>
    </div>
  );
}
