import { useRef, useState, useEffect, useCallback } from 'react';
import type { UserCardData } from '../../hooks/useThumbnailTester';

interface YouTubeLivePreviewProps {
  userCard: UserCardData;
}

type WebviewElement = HTMLElement & {
  src: string;
  executeJavaScript: (code: string) => Promise<unknown>;
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  reload: () => void;
  getURL: () => string;
};

/**
 * Builds a JS string that YouTube's webview will execute to replace
 * a random video card's thumbnail, title, channel name and avatar
 * with the user's data.
 *
 * YouTube's DOM is tricky:
 * - Home page uses <yt-image> web components inside <ytd-rich-item-renderer>
 *   that manage their own <img> and override src changes.
 * - Search uses <ytd-video-renderer> with a simpler <img> inside <ytd-thumbnail>.
 * - Sidebar uses <ytd-compact-video-renderer>.
 *
 * Strategy: hide the original thumbnail container and overlay our own <img>.
 * Use a MutationObserver to guard against YouTube re-rendering.
 */
function buildInjectionScript(userCard: UserCardData, cardIndex: number): string {
  const thumbSrc = userCard.thumbnailDataUrl ?? '';
  const title = (userCard.videoTitle || 'Your Video Title').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
  const channel = (userCard.channelName || 'Your Channel').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const avatarSrc = userCard.channelAvatarDataUrl ?? '';

  return `
(function() {
  try {
    // ── Clean up previous injection ──
    document.querySelectorAll('[data-vidtsx-injected]').forEach(el => {
      el.removeAttribute('data-vidtsx-injected');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    document.querySelectorAll('.vidtsx-overlay').forEach(el => el.remove());
    if (window.__vidtsxObserver) { window.__vidtsxObserver.disconnect(); window.__vidtsxObserver = null; }

    // ── Find video cards across all page types ──
    // Home page
    let cards = Array.from(document.querySelectorAll('ytd-rich-item-renderer:not([is-slim-media])'));
    let pageType = 'home';

    // Search results
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('ytd-video-renderer'));
      pageType = 'search';
    }

    // Watch page sidebar
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('ytd-compact-video-renderer'));
      pageType = 'sidebar';
    }

    // Shorts shelf items (skip shorts, they're vertical)
    cards = cards.filter(c => !c.closest('ytd-rich-shelf-renderer'));

    if (cards.length === 0) return 'NO_CARDS_FOUND';

    const idx = Math.min(${cardIndex}, cards.length - 1);
    const card = cards[idx];

    // ── Helper: overlay an image on a container ──
    function overlayImage(container, src, fit) {
      if (!container || !src) return;
      // Make container a positioning context
      container.style.position = 'relative';

      const overlay = document.createElement('img');
      overlay.src = src;
      overlay.className = 'vidtsx-overlay';
      overlay.style.cssText =
        'position:absolute; inset:0; width:100%; height:100%; object-fit:' + (fit || 'cover') +
        '; z-index:10; border-radius:inherit; pointer-events:none;';
      container.appendChild(overlay);
    }

    // ── Replace thumbnail ──
    if ('${thumbSrc}') {
      // Find the thumbnail anchor/container — works for all page types
      const thumbContainer =
        card.querySelector('ytd-thumbnail a#thumbnail') ||
        card.querySelector('ytd-thumbnail') ||
        card.querySelector('a#thumbnail') ||
        card.querySelector('.ytd-thumbnail');

      if (thumbContainer) {
        overlayImage(thumbContainer, '${thumbSrc}', 'cover');
      }
    }

    // ── Replace title ──
    // Try multiple selectors — YouTube uses different structures
    const titleEl =
      card.querySelector('#video-title') ||
      card.querySelector('h3 a') ||
      card.querySelector('#video-title-link yt-formatted-string');

    if (titleEl) {
      // Handle yt-formatted-string (has shadow DOM in some cases, textContent works)
      const inner = titleEl.querySelector('yt-formatted-string') || titleEl;
      inner.textContent = '${title}';
      inner.setAttribute('title', '${title}');
      titleEl.setAttribute('title', '${title}');
      titleEl.setAttribute('aria-label', '${title}');
    }

    // ── Replace channel name ──
    const channelContainer = card.querySelector('#channel-name');
    if (channelContainer) {
      const channelEls = channelContainer.querySelectorAll('a, yt-formatted-string');
      channelEls.forEach(function(el) {
        el.textContent = '${channel}';
        if (el.hasAttribute('title')) el.setAttribute('title', '${channel}');
      });
    }

    // ── Replace channel avatar ──
    if ('${avatarSrc}') {
      const avatarLink =
        card.querySelector('#avatar-link') ||
        card.querySelector('a.ytd-rich-grid-media') ||
        card.querySelector('#avatar');

      if (avatarLink) {
        const avatarContainer = avatarLink.querySelector('yt-image, yt-img-shadow, #img') || avatarLink;
        overlayImage(avatarContainer, '${avatarSrc}', 'cover');
        // Also make the overlay round
        const avatarOverlay = avatarContainer.querySelector('.vidtsx-overlay');
        if (avatarOverlay) avatarOverlay.style.borderRadius = '50%';
      }
    }

    // ── Replace metadata (views / time) ──
    const metaLine = card.querySelector('#metadata-line');
    if (metaLine) {
      const spans = metaLine.querySelectorAll('span.inline-metadata-item');
      if (spans.length >= 1) spans[0].textContent = '0 views';
      if (spans.length >= 2) spans[1].textContent = 'just now';
    }
    // Fallback: ytd-video-meta-block
    const metaBlock = card.querySelector('ytd-video-meta-block #metadata-line');
    if (metaBlock && metaBlock !== metaLine) {
      const spans = metaBlock.querySelectorAll('span');
      if (spans.length >= 1) spans[0].textContent = '0 views';
      if (spans.length >= 2) spans[1].textContent = 'just now';
    }

    // ── Guard against YouTube re-rendering with MutationObserver ──
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        // If YouTube re-adds images or changes src, re-apply our overlay
        if (m.type === 'childList' || m.type === 'attributes') {
          const existingOverlay = card.querySelector('ytd-thumbnail .vidtsx-overlay');
          if (!existingOverlay && '${thumbSrc}') {
            const tc = card.querySelector('ytd-thumbnail a#thumbnail') || card.querySelector('ytd-thumbnail');
            if (tc) overlayImage(tc, '${thumbSrc}', 'cover');
          }
        }
      });
    });
    observer.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    window.__vidtsxObserver = observer;

    // ── Mark injected card ──
    card.setAttribute('data-vidtsx-injected', 'true');
    card.style.outline = '2px solid #7F77DD';
    card.style.outlineOffset = '4px';
    card.style.borderRadius = '12px';

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return 'INJECTED_OK:' + pageType + ':card' + idx + ':of' + cards.length;
  } catch(e) {
    return 'ERROR: ' + e.message;
  }
})();
`;
}

export function YouTubeLivePreview({ userCard }: YouTubeLivePreviewProps) {
  const webviewRef = useRef<WebviewElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [injectionStatus, setInjectionStatus] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(3);

  // Handle webview load events
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onStart = () => {
      setIsLoading(true);
      setIsReady(false);
      setInjectionStatus(null);
    };
    const onStop = () => {
      setIsLoading(false);
      // Give YouTube a moment to hydrate its dynamic components
      setTimeout(() => setIsReady(true), 2500);
    };

    webview.addEventListener('did-start-loading', onStart);
    webview.addEventListener('did-stop-loading', onStop);

    return () => {
      webview.removeEventListener('did-start-loading', onStart);
      webview.removeEventListener('did-stop-loading', onStop);
    };
  }, []);

  const inject = useCallback(async () => {
    const webview = webviewRef.current;
    if (!webview || !isReady) return;

    setInjectionStatus('injecting');
    const script = buildInjectionScript(userCard, cardIndex);
    const result = await webview.executeJavaScript(script) as string;

    if (result.startsWith('INJECTED_OK')) {
      setInjectionStatus('success');
    } else if (result === 'NO_CARDS_FOUND') {
      setInjectionStatus('no_cards');
    } else {
      setInjectionStatus('error');
    }
  }, [userCard, cardIndex, isReady]);

  const randomizeAndInject = useCallback(async () => {
    const newIndex = Math.floor(Math.random() * 12);
    setCardIndex(newIndex);
    const webview = webviewRef.current;
    if (!webview || !isReady) return;

    setInjectionStatus('injecting');
    const script = buildInjectionScript(userCard, newIndex);
    const result = await webview.executeJavaScript(script) as string;

    if (result.startsWith('INJECTED_OK')) {
      setInjectionStatus('success');
    } else if (result === 'NO_CARDS_FOUND') {
      setInjectionStatus('no_cards');
    } else {
      setInjectionStatus('error');
    }
  }, [userCard, isReady]);

  const reload = useCallback(() => {
    webviewRef.current?.reload();
    setInjectionStatus(null);
  }, []);

  const canInject = isReady && !isLoading && userCard.thumbnailDataUrl;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0f0f0f' }}>
      {/* Control bar */}
      <div
        className="flex items-center gap-3 px-4 h-[44px] shrink-0"
        style={{ backgroundColor: '#1a1a1e', borderBottom: '1px solid #272727' }}
      >
        {/* Inject button */}
        <button
          onClick={inject}
          disabled={!canInject}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
          style={{
            backgroundColor: canInject ? '#7F77DD' : '#333',
            color: canInject ? '#fff' : '#666',
            cursor: canInject ? 'pointer' : 'not-allowed',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Inject Thumbnail
        </button>

        {/* Randomize & inject */}
        <button
          onClick={randomizeAndInject}
          disabled={!canInject}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
          style={{
            backgroundColor: canInject ? '#333' : '#222',
            color: canInject ? '#f1f1f1' : '#666',
            cursor: canInject ? 'pointer' : 'not-allowed',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          Random Position
        </button>

        {/* Reload */}
        <button
          onClick={reload}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
          style={{ backgroundColor: '#333', color: '#f1f1f1' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Reload
        </button>

        {/* Position */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[11px]" style={{ color: '#aaa' }}>Card #</span>
          <input
            type="number"
            min={0}
            max={20}
            value={cardIndex}
            onChange={(e) => setCardIndex(Number(e.target.value))}
            className="w-[48px] px-2 py-1 rounded-[4px] text-[12px] text-center"
            style={{ backgroundColor: '#272727', color: '#f1f1f1', border: '1px solid #3a3a3a' }}
          />
        </div>

        {/* Status */}
        <div className="ml-auto flex items-center gap-2">
          {isLoading && (
            <span className="text-[11px]" style={{ color: '#aaa' }}>Loading YouTube...</span>
          )}
          {!isLoading && !isReady && (
            <span className="text-[11px]" style={{ color: '#aaa' }}>Waiting for page...</span>
          )}
          {isReady && !injectionStatus && (
            <span className="text-[11px]" style={{ color: '#5DCAA5' }}>Ready to inject</span>
          )}
          {injectionStatus === 'injecting' && (
            <span className="text-[11px]" style={{ color: '#EF9F27' }}>Injecting...</span>
          )}
          {injectionStatus === 'success' && (
            <span className="text-[11px]" style={{ color: '#5DCAA5' }}>Injected! Scroll to highlighted card.</span>
          )}
          {injectionStatus === 'no_cards' && (
            <span className="text-[11px]" style={{ color: '#F09595' }}>No video cards found. Try scrolling down first.</span>
          )}
          {injectionStatus === 'error' && (
            <span className="text-[11px]" style={{ color: '#F09595' }}>Injection failed. Try reloading.</span>
          )}
          {!userCard.thumbnailDataUrl && isReady && (
            <span className="text-[11px]" style={{ color: '#EF9F27' }}>Upload a thumbnail first</span>
          )}
        </div>
      </div>

      {/* Webview */}
      <div className="flex-1 relative">
        {/* @ts-expect-error webview is an Electron-specific HTML element not in React types */}
        <webview
          ref={webviewRef}
          src="https://www.youtube.com"
          style={{ width: '100%', height: '100%' }}
          partition="persist:youtube-tester"
        />
        {/* Loading overlay */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15,15,15,0.85)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <svg width="40" height="28" viewBox="0 0 90 65" fill="none">
                <rect width="90" height="65" rx="16" fill="#FF0000" />
                <path d="M36 18V47L62 32.5L36 18Z" fill="white" />
              </svg>
              <span className="text-[13px]" style={{ color: '#aaa', fontFamily: 'Roboto, Arial, sans-serif' }}>
                Loading YouTube...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
