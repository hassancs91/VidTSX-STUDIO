import { useHomeData } from '../hooks/useHomeData';
import { UpdateBanner } from './UpdateBanner';
import { WelcomeHeader } from './WelcomeHeader';
import { QuickActions } from './QuickActions';
import { NewsFeed } from './NewsFeed';
import { WhatsNew } from './WhatsNew';
import { GettingStarted } from './GettingStarted';
import { DiscordWidget } from './DiscordWidget';
import { AdsWidget } from './AdsWidget';

export function HomeScreen() {
  const {
    data,
    showWhatsNew,
    showGettingStarted,
    showNewsAndTips,
    showAds,
  } = useHomeData();

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Update banner — full width */}
          <UpdateBanner />

          {/* Two-column layout */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_280px]">
            {/* Left column */}
            <div className="flex flex-col gap-5 min-w-0">
              <WelcomeHeader />
              <QuickActions />
              {showNewsAndTips && (
                <NewsFeed items={data!.newsAndTips!.items!} />
              )}
            </div>

            {/* Right column — DiscordWidget is always visible */}
            <div className="flex flex-col gap-3">
              <DiscordWidget />
              {showWhatsNew && (
                <WhatsNew
                  entries={data!.whatsNew!.entries!}
                  appVersion={data!.whatsNew!.appVersion}
                />
              )}
              {showGettingStarted && (
                <GettingStarted guides={data!.gettingStarted!.guides!} />
              )}
              {showAds && <AdsWidget ads={data!.ads!.items!} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
