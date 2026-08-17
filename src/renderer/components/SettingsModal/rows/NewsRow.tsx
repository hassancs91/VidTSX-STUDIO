import { useEffect, useState } from 'react';

/** "Show news and announcements" (Phase I5). Self-contained like
 *  UpdateSection — reads and writes over the news IPC, no props threaded
 *  through the modal. Off means the app never fetches the feed at all. */
export function NewsRow() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.api.newsGet();
        if (!cancelled && res.success) setEnabled(res.enabled);
      } catch {
        if (!cancelled) setEnabled(true); // Default-on; the toggle still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (next: boolean) => {
    setEnabled(next);
    void window.api.newsSetEnabled({ enabled: next });
  };

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">Show news and announcements</div>
          <div className="text-[10px] text-text-dim">
            On launch the app fetches a small static file from vidtsx.com with product news
            and template drops. Nothing about you is sent. Turning this off stops the fetch
            entirely.
          </div>
        </div>
        <input
          type="checkbox"
          className="w-4 h-4 accent-accent cursor-pointer shrink-0 disabled:cursor-not-allowed"
          checked={enabled === true}
          onChange={(e) => toggle(e.target.checked)}
          disabled={enabled === null}
          data-news-toggle
        />
      </div>
    </div>
  );
}
