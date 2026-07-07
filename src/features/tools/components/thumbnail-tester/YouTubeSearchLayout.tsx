import { VideoCard } from './VideoCard';
import { YouTubeHeader } from './YouTubeHeader';
import type { SampleVideoCard } from '../../data/thumbnail-tester-samples';
import type { UserCardData } from '../../hooks/useThumbnailTester';

interface YouTubeSearchLayoutProps {
  competitors: SampleVideoCard[];
  userCard: UserCardData;
  userCardIndex: number;
  highlightUserCard: boolean;
}

export function YouTubeSearchLayout({ competitors, userCard, userCardIndex, highlightUserCard }: YouTubeSearchLayoutProps) {
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
          layout="search"
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
            layout="search"
            verified={competitorIdx % 3 === 0}
          />,
        );
      }
      competitorIdx++;
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: '#0f0f0f', fontFamily: 'Roboto, Arial, sans-serif' }}>
      <YouTubeHeader searchQuery="video topic" />
      {/* Filter bar */}
      <div
        className="flex items-center gap-3 px-6 py-2 shrink-0"
        style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #272727' }}
      >
        <span
          className="flex items-center gap-2 px-3 py-[6px] rounded-lg text-[14px]"
          style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 500, backgroundColor: '#272727', color: '#f1f1f1', cursor: 'default' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#f1f1f1">
            <path d="M3 5h18v2H3V5zm3 6h12v2H6v-2zm4 6h4v2h-4v-2z" />
          </svg>
          Filters
        </span>
      </div>
      {/* Results */}
      <div className="flex-1 px-6 pt-4 pb-8" style={{ maxWidth: '900px', marginLeft: '56px' }}>
        <div className="flex flex-col gap-[16px]">
          {cards}
        </div>
      </div>
    </div>
  );
}
