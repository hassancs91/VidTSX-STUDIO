import { useCallback, useEffect, useState } from 'react';
import type { NewsMessage } from '@shared/types/news-feed';

/** Announcements for the app-level card (Phase I4). One fetch per renderer
 *  mount — main already memoizes the network fetch per launch and filters
 *  dismissed/disabled, so this list is exactly what may be shown. */
export function useNews() {
  const [messages, setMessages] = useState<NewsMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.api.newsGet();
        if (!cancelled && res.success) setMessages(res.messages);
      } catch {
        // News is never worth an error state — show nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    // Optimistic: the card disappears immediately; persistence is fire-and-
    // forget (worst case the message reappears next launch).
    setMessages((prev) => prev.filter((m) => m.id !== id));
    void window.api.newsDismiss({ id });
  }, []);

  return { messages, dismiss };
}
