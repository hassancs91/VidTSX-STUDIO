import { VideoCard } from './VideoCard';
import { YouTubeHeader } from './YouTubeHeader';
import { CategoryChips } from './CategoryChips';
import type { SampleVideoCard } from '../../data/thumbnail-tester-samples';
import type { UserCardData } from '../../hooks/useThumbnailTester';

interface YouTubeGridProps {
  competitors: SampleVideoCard[];
  userCard: UserCardData;
  userCardIndex: number;
  highlightUserCard: boolean;
}

export function YouTubeGrid({ competitors, userCard, userCardIndex, highlightUserCard }: YouTubeGridProps) {
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
          layout="grid"
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
            layout="grid"
            verified={competitorIdx % 3 === 0}
          />,
        );
      }
      competitorIdx++;
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: '#0f0f0f', fontFamily: 'Roboto, Arial, sans-serif' }}>
      <YouTubeHeader />
      <CategoryChips />
      <div
        className="flex-1 px-4 pt-6 pb-8"
        style={{ marginLeft: '56px' }}
      >
        <div
          className="grid gap-x-[16px] gap-y-[40px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))' }}
        >
          {cards}
        </div>
      </div>
    </div>
  );
}
