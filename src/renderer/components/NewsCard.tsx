import { X } from 'lucide-react';
import type { NewsMessage } from '@shared/types/news-feed';
import { useNews } from '../hooks/useNews';

/** Left-accent color per message type (toast idiom from UI_SPEC). */
const TYPE_ACCENTS: Record<NewsMessage['type'], string> = {
  announcement: 'var(--color-accent, #7F77DD)',
  tip: '#5DCAA5',
  promo: '#E0A458',
};

/** App-level announcements card (Phase I4): bottom-right, dismissible, one
 *  message at a time — dismissing reveals the next, if any. Links open in
 *  the default browser only (trust rule 2); renders nothing when the feed
 *  is empty, disabled, or unreachable. */
export function NewsCard() {
  const { messages, dismiss } = useNews();
  const message = messages[0];
  if (!message) return null;

  return (
    <div
      className="fixed z-40 bottom-8 right-3 w-[300px] rounded-[8px] bg-app-surface shadow-lg p-3"
      style={{
        border: '0.5px solid var(--color-border)',
        borderLeft: `2px solid ${TYPE_ACCENTS[message.type]}`,
      }}
      data-news-card={message.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium text-text-primary leading-snug">
          {message.title}
        </div>
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
            onClick={() => void window.api.appOpenExternal({ url: message.url! })}
            data-news-cta
            className="px-2.5 py-1 rounded-[5px] bg-accent text-white text-[10px] font-medium hover:opacity-90 transition-opacity"
          >
            {message.cta ?? 'Learn more'}
          </button>
        </div>
      )}
    </div>
  );
}
