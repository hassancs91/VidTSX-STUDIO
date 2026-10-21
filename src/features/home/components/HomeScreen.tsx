import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useHomeSummary } from '../hooks/useHomeSummary';
import { HomeHeader } from './HomeHeader';
import { ContinueSection } from './ContinueSection';
import { StartTiles } from './StartTiles';
import { StatusStrip } from './StatusStrip';
import { AnnouncementsSection } from './AnnouncementsSection';

/**
 * Home (V1 completion plan §2.6) — the default screen. Header, Continue,
 * Start, Status, Announcements, top to bottom; one IPC for the data plus the
 * feed's own; nothing spawned. Every card and tile leaves through the app's
 * navigation event, so this feature imports no other feature.
 */
export function HomeScreen() {
  const { summary, error } = useHomeSummary();

  return (
    <div className="flex flex-col h-full" data-home-screen>
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Home</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3" {...(summary ? { 'data-home-ready': '' } : {})}>
        {/* Full width: the grids are auto-fill (more columns on a wide window),
            so no cap — a capped column sat left-aligned with empty space on a
            maximized screen (Hasan, 2026-10-05). */}
        <div className="flex flex-col gap-5">
          <HomeHeader version={summary?.version ?? ''} update={summary?.update ?? null} />
          {error && <ErrorBanner message={error} />}
          <ContinueSection summary={summary} />
          <StartTiles />
          <StatusStrip status={summary?.status ?? null} />
          <AnnouncementsSection />
        </div>
      </div>
    </div>
  );
}
