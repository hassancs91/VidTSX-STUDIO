import { X } from 'lucide-react';
import type { NewsMessage } from '@shared/types/news-feed';
import { useNews } from '@renderer/hooks/useNews';
import { SectionRow } from './SectionRow';

/** Left-accent color per message type (the toast idiom from UI_SPEC). */
const TYPE_ACCENTS: Record<NewsMessage['type'], string> = {
  announcement: 'var(--color-accent)',
  tip: 'var(--color-accent-green)',
  promo: 'var(--color-accent-amber)',
};

/** How many messages show at once; dismissing one reveals the next. */
const VISIBLE = 3;

/**
 * The announcements feed (Phase I), moved here from the app-level card (W6).
 * Same trust rules: main validated the messages, links open externally only,
 * a dismissed id never reshows. Renders nothing when the feed is off, empty
 * or unreachable — the section simply is not there.
 */
export function AnnouncementsSection() {
  const { messages, dismiss } = useNews();
  const visible = messages.slice(0, VISIBLE);
  if (visible.length === 0) return null;

  return (
    <section data-home-section="announcements">
      <SectionRow title="Announcements" />
      <div className="flex flex-col gap-2">
        {visible.map((message) => (
          <div
            key={message.id}
            className="rounded-[8px] bg-app-surface px-3 py-2.5"
            style={{
              border: '0.5px solid var(--color-border)',
              borderLeft: `2px solid ${TYPE_ACCENTS[message.type]}`,
            }}
            data-news-card={message.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-medium text-text-primary leading-snug">{message.title}</div>
              <button
                type="button"
                onClick={() => dismiss(message.id)}
                title="Dismiss"
                data-news-dismiss
                className="shrink-0 -m-1 p-1 rounded text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
            <div className="text-[10px] text-text-dim leading-snug mt-1">{message.body}</div>
            {message.url && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => void window.api.appOpenExternal({ url: message.url as string })}
                  data-news-cta
                  className="px-2.5 py-1 rounded-[5px] bg-accent text-white text-[10px] font-medium hover:opacity-90 transition-opacity"
                >
                  {message.cta ?? 'Learn more'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
