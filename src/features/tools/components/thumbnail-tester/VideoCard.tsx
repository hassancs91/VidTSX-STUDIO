export type CardLayout = 'grid' | 'search' | 'sidebar';

const YT_FONT = 'Roboto, Arial, sans-serif';

interface VideoCardProps {
  thumbnail: string | null;
  thumbnailGradient?: string;
  title: string;
  channelName: string;
  channelAvatar: string | null;
  avatarColor?: string;
  views: string;
  timeAgo: string;
  duration: string;
  layout: CardLayout;
  isHighlighted?: boolean;
  verified?: boolean;
}

export function VideoCard(props: VideoCardProps) {
  if (props.layout === 'sidebar') return <SidebarCard {...props} />;
  if (props.layout === 'search') return <SearchCard {...props} />;
  return <GridCard {...props} />;
}

/* ── Thumbnail ─────────────────────────────────────────── */

function ThumbnailBox({
  thumbnail,
  thumbnailGradient,
  duration,
  rounded,
}: {
  thumbnail: string | null;
  thumbnailGradient?: string;
  duration: string;
  rounded?: string;
}) {
  return (
    <div
      className="relative overflow-hidden w-full"
      style={{ aspectRatio: '16/9', borderRadius: rounded ?? '12px' }}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full" style={{ background: thumbnailGradient ?? '#333' }} />
      )}
      {/* Duration badge */}
      <span
        className="absolute bottom-[4px] right-[4px] px-[4px] py-[1px] rounded-[4px] leading-[12px]"
        style={{
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: YT_FONT,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          letterSpacing: '0.5px',
        }}
      >
        {duration}
      </span>
      {/* Progress bar placeholder */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <div
          className="h-full"
          style={{ width: `${Math.floor(Math.random() * 60 + 10)}%`, backgroundColor: '#ff0000' }}
        />
      </div>
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────── */

function AvatarCircle({
  channelAvatar,
  avatarColor,
  size,
}: {
  channelAvatar: string | null;
  avatarColor?: string;
  size: number;
}) {
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, backgroundColor: avatarColor ?? '#555' }}
    >
      {channelAvatar && (
        <img src={channelAvatar} alt="" className="w-full h-full object-cover" draggable={false} />
      )}
    </div>
  );
}

/* ── Verified Badge ─────────────────────────────────── */

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#aaaaaa" className="shrink-0 ml-1" style={{ marginTop: 1 }}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

/* ── Three-dot menu ─────────────────────────────────── */

function ThreeDotMenu() {
  return (
    <div className="w-6 h-6 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ cursor: 'default' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#f1f1f1">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
      </svg>
    </div>
  );
}

/* ── Grid Card (Home page) ─────────────────────────── */

function GridCard({
  thumbnail,
  thumbnailGradient,
  title,
  channelName,
  channelAvatar,
  avatarColor,
  views,
  timeAgo,
  duration,
  isHighlighted,
  verified,
}: VideoCardProps) {
  return (
    <div
      className="flex flex-col group"
      style={isHighlighted ? {
        outline: '2px solid #7F77DD',
        outlineOffset: 6,
        borderRadius: 12,
      } : undefined}
    >
      <ThumbnailBox thumbnail={thumbnail} thumbnailGradient={thumbnailGradient} duration={duration} />
      <div className="flex gap-3 mt-[12px]">
        <AvatarCircle channelAvatar={channelAvatar ?? null} avatarColor={avatarColor} size={36} />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-start">
            <p
              className="flex-1 min-w-0"
              style={{
                color: '#f1f1f1',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: YT_FONT,
                lineHeight: '20px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </p>
            <ThreeDotMenu />
          </div>
          <div className="flex items-center mt-[4px]">
            <span style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT, lineHeight: '18px' }}>
              {channelName}
            </span>
            {verified && <VerifiedBadge />}
          </div>
          <span style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT, lineHeight: '18px' }}>
            {views} &middot; {timeAgo}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Search Card ───────────────────────────────────── */

function SearchCard({
  thumbnail,
  thumbnailGradient,
  title,
  channelName,
  channelAvatar,
  avatarColor,
  views,
  timeAgo,
  duration,
  isHighlighted,
  verified,
}: VideoCardProps) {
  return (
    <div
      className="flex gap-4 group"
      style={isHighlighted ? {
        outline: '2px solid #7F77DD',
        outlineOffset: 6,
        borderRadius: 12,
      } : undefined}
    >
      <div className="w-[360px] shrink-0">
        <ThumbnailBox thumbnail={thumbnail} thumbnailGradient={thumbnailGradient} duration={duration} />
      </div>
      <div className="flex flex-col min-w-0 py-[4px] flex-1">
        <div className="flex items-start">
          <p
            className="flex-1 min-w-0"
            style={{
              color: '#f1f1f1',
              fontSize: '18px',
              fontWeight: 400,
              fontFamily: YT_FONT,
              lineHeight: '26px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </p>
          <ThreeDotMenu />
        </div>
        <span className="mt-[8px]" style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT, lineHeight: '18px' }}>
          {views} &middot; {timeAgo}
        </span>
        <div className="flex items-center gap-[8px] mt-[12px]">
          <AvatarCircle channelAvatar={channelAvatar ?? null} avatarColor={avatarColor} size={24} />
          <span style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT }}>
            {channelName}
          </span>
          {verified && <VerifiedBadge />}
        </div>
        {/* Fake description snippet */}
        <p
          className="mt-[8px]"
          style={{
            color: '#aaaaaa',
            fontSize: '12px',
            fontFamily: YT_FONT,
            lineHeight: '18px',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          Click to watch the full video. Like and subscribe for more content...
        </p>
      </div>
    </div>
  );
}

/* ── Sidebar Card (Up Next) ────────────────────────── */

function SidebarCard({
  thumbnail,
  thumbnailGradient,
  title,
  channelName,
  views,
  timeAgo,
  duration,
  isHighlighted,
}: VideoCardProps) {
  return (
    <div
      className="flex gap-[8px] group"
      style={isHighlighted ? {
        outline: '2px solid #7F77DD',
        outlineOffset: 3,
        borderRadius: 8,
      } : undefined}
    >
      <div className="w-[168px] shrink-0">
        <ThumbnailBox thumbnail={thumbnail} thumbnailGradient={thumbnailGradient} duration={duration} rounded="8px" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-start">
          <p
            className="flex-1 min-w-0"
            style={{
              color: '#f1f1f1',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: YT_FONT,
              lineHeight: '20px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </p>
          <ThreeDotMenu />
        </div>
        <span className="mt-[4px]" style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT, lineHeight: '18px' }}>
          {channelName}
        </span>
        <span style={{ color: '#aaaaaa', fontSize: '12px', fontFamily: YT_FONT, lineHeight: '18px' }}>
          {views} &middot; {timeAgo}
        </span>
      </div>
    </div>
  );
}
