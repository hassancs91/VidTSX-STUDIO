// @vidtsx/kit — BrowserWindow: a NAVIGABLE fake browser. Feed it pages (full-
// height capture stills or live nodes) and a navigation script — type a URL in
// the address bar, loading state (tab spinner + progress rule), page reveal,
// scroll-to, navigate again — and it plays a believable browsing session.
// Chrome colors stay app-faithful; the caller's accent appears only in the
// loading rule, caret, and click ripples. Optional cursor path + click ripples
// complete the screencast illusion.
import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, resolveTheme, type KitTheme } from './theme';
import { EASINGS } from './easings';
import { KitIcon } from './icons';
import { typeDuration } from './typed-text';

const BR = {
  chrome: '#dee1e6', tabActive: '#f7f8fa', urlBar: '#eff1f4',
  text: '#3c4043', dim: '#5f6368', disabled: '#b9bdc4',
} as const;

/** Chrome heights at uiScale 1 (tab strip + nav bar). */
export const BROWSER_CHROME = { tab: 46, nav: 56 } as const;
export const browserChromeH = (uiScale = 1) => (BROWSER_CHROME.tab + BROWSER_CHROME.nav) * uiScale;

export type BrowserPage = {
  /** Address-bar text once this page is current. */
  url: string;
  /** Tab label once this page is current. */
  title: string;
  /** Full-height capture still (any asset URL). Renders at page width, natural
   *  aspect — a tall still gives the page real scroll range. */
  src?: string;
  /** Or live TSX content instead of a still. */
  node?: React.ReactNode;
  bg?: string;
  /** Constant "alive" zoom drift while the page is showing (default 0.015). */
  drift?: number;
};

export type NavStep =
  /** Type into the address bar (typically before a 'go'). */
  | { at: number; kind: 'type'; text: string; perChar?: number }
  /** Commit navigation: loading state for loadFrames (default 16), then the page reveals. */
  | { at: number; kind: 'go'; page: number; loadFrames?: number }
  /** Scroll the currently-visible page to `to` px (eased, default 30 frames). */
  | { at: number; kind: 'scroll'; to: number; frames?: number };

export type CursorKey = { frame: number; x: number; y: number }; // x,y = fraction of the page viewport

/** Sample a piecewise cursor path (eased per segment). */
export const sampleCursor = (frame: number, keys: readonly CursorKey[]) => {
  if (!keys.length) return { x: 0.5, y: 0.5 };
  if (frame <= keys[0].frame) return { x: keys[0].x, y: keys[0].y };
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return { x: last.x, y: last.y };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].frame <= frame) i++;
  const a = keys[i], b = keys[i + 1];
  const t = interpolate(frame, [a.frame, b.frame], [0, 1], { ...CLAMP, easing: EASINGS.easeInOut });
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

export const CursorPointer: React.FC<{ size?: number; press?: number }> = ({ size = 30, press = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `scale(${press})`, transformOrigin: '16% 10%', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))', display: 'block' }}>
    <path d="M4.2 2.6 L4.2 18.9 L8.7 14.7 L11.9 21.6 L14.6 20.3 L11.4 13.6 L17.6 13.6 Z" fill="#111318" stroke="#ffffff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

const Spinner: React.FC<{ size: number; frame: number; color: string }> = ({ size, frame, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${(frame * 14) % 360}deg)`, display: 'block' }}>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="34 20" />
  </svg>
);

const revealFrame = (s: Extract<NavStep, { kind: 'go' }>) => s.at + (s.loadFrames ?? 16);

export const BrowserWindow: React.FC<{
  pages: BrowserPage[];
  /** The navigation script. Start with `{ at: 0, kind: 'go', page: 0, loadFrames: 0 }`
   *  to open on a page; without an initial 'go' the window starts on a blank tab. */
  script?: readonly NavStep[];
  box?: { x: number; y: number; w: number; h: number };
  appearAt?: number;
  /** Scales the chrome. 1 for 1920×1080; ~1.9 for a 1080-wide vertical short. */
  uiScale?: number;
  cursor?: readonly CursorKey[];
  clicks?: readonly number[];
  theme?: Partial<KitTheme>;
}> = ({ pages, script = [], box = { x: 80, y: 44, w: 1760, h: 992 }, appearAt = 0, uiScale = 1, cursor = [], clicks = [], theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = resolveTheme(theme);
  const s = (n: number) => n * uiScale;
  const TAB_H = s(BROWSER_CHROME.tab), NAV_H = s(BROWSER_CHROME.nav);
  const steps = [...script].sort((a, b) => a.at - b.at);
  const gos = steps.filter((st): st is Extract<NavStep, { kind: 'go' }> => st.kind === 'go');

  // -- navigation state at this frame
  const revealed = gos.filter((g) => frame >= revealFrame(g));
  const activeGo = revealed[revealed.length - 1];
  const active = activeGo ? pages[activeGo.page] : undefined;
  const loadingGo = gos.find((g) => frame >= g.at && frame < revealFrame(g));
  const loading = loadingGo !== undefined;

  // -- address bar: last committed 'go' vs an in-progress 'type'
  const barSteps = steps.filter((st) => st.kind !== 'scroll' && st.at <= frame);
  const lastBar = barSteps[barSteps.length - 1];
  let barText = '';
  let caretOn = false;
  if (lastBar?.kind === 'type') {
    const end = lastBar.at + typeDuration(lastBar.text, lastBar.perChar ?? 1.1);
    const shown = Math.floor(interpolate(frame, [lastBar.at, end], [0, lastBar.text.length], { ...CLAMP, easing: EASINGS.easeInOut }));
    barText = lastBar.text.slice(0, shown);
    caretOn = Math.floor(frame / 15) % 2 === 0;
  } else if (lastBar?.kind === 'go') {
    barText = pages[lastBar.page]?.url ?? '';
  }

  // -- per-page scroll: each 'scroll' step targets the page visible at its cue
  const scrollAt = (pageIdx: number): number => {
    let y = 0;
    for (const st of steps) {
      if (st.kind !== 'scroll') continue;
      const owner = gos.filter((g) => revealFrame(g) <= st.at).pop();
      if (!owner || owner.page !== pageIdx) continue;
      y = interpolate(frame, [st.at, st.at + (st.frames ?? 30)], [y, st.to], { ...CLAMP, easing: EASINGS.easeInOut });
    }
    return y;
  };

  const winOp = interpolate(frame, [appearAt, appearAt + 14], [0, 1], { ...CLAMP, easing: EASINGS.easeOut });
  const winDy = interpolate(frame, [appearAt, appearAt + 16], [28, 0], { ...CLAMP, easing: EASINGS.easeOut });
  const region = { x: box.x, y: box.y + TAB_H + NAV_H, w: box.w, h: box.h - TAB_H - NAV_H };
  const cur = sampleCursor(frame, cursor);
  const press = clicks.reduce((p, cf) => (frame < cf - 4 || frame > cf + 8 ? p : interpolate(frame, [cf - 4, cf, cf + 8], [1, 0.8, 1], CLAMP)), 1);
  const progress = loadingGo ? interpolate(frame, [loadingGo.at, revealFrame(loadingGo)], [0, 0.9], { ...CLAMP, easing: EASINGS.easeOut }) : 0;

  return (
    <>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: s(14), overflow: 'hidden', border: `1px solid ${t.line}`, boxShadow: '0 10px 40px rgba(20,20,35,0.14)', opacity: winOp, transform: `translateY(${winDy}px)`, fontFamily: t.fontBody, background: active?.bg ?? '#ffffff' }}>
        {/* tab strip — chrome paints ABOVE the page, as in a real browser */}
        <div style={{ position: 'relative', zIndex: 2, height: TAB_H, background: BR.chrome, display: 'flex', alignItems: 'flex-end', paddingLeft: s(14) }}>
          <div style={{ display: 'flex', gap: s(9), alignItems: 'center', paddingBottom: s(15), paddingRight: s(16) }}>
            <span style={{ width: s(13), height: s(13), borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: s(13), height: s(13), borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: s(13), height: s(13), borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: s(10), background: BR.tabActive, borderRadius: `${s(10)}px ${s(10)}px 0 0`, padding: `${s(9)}px ${s(16)}px`, minWidth: s(260), maxWidth: s(420) }}>
            {loading
              ? <Spinner size={s(17)} frame={frame} color={t.accent} />
              : <KitIcon name="globe" size={s(17)} color={BR.dim} strokeWidth={2} />}
            <span style={{ fontSize: s(17), color: BR.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {loading ? (pages[loadingGo!.page]?.title ?? '…') : (active?.title ?? 'New Tab')}
            </span>
            <KitIcon name="x" size={s(15)} color={BR.dim} />
          </div>
          <KitIcon name="plus" size={s(18)} color={BR.dim} style={{ margin: `0 0 ${s(14)}px ${s(12)}px` }} />
        </div>
        {/* nav / URL bar */}
        <div style={{ position: 'relative', zIndex: 2, height: NAV_H, background: BR.tabActive, display: 'flex', alignItems: 'center', gap: s(14), padding: `0 ${s(18)}px`, borderBottom: `1px solid ${BR.chrome}` }}>
          <KitIcon name="arrowLeft" size={s(20)} color={revealed.length > 1 ? BR.text : BR.disabled} strokeWidth={2.2} />
          <KitIcon name="arrowRight" size={s(20)} color={BR.disabled} strokeWidth={2.2} />
          <KitIcon name="rotateCw" size={s(18)} color={BR.text} strokeWidth={2.2} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: s(10), background: BR.urlBar, borderRadius: 999, padding: `${s(8)}px ${s(18)}px` }}>
            <KitIcon name="lock" size={s(15)} color={BR.dim} />
            <span style={{ fontFamily: t.fontMono, fontSize: s(17), color: BR.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {barText}
              {lastBar?.kind === 'type' && <span style={{ opacity: caretOn ? 1 : 0, color: t.accent }}>▌</span>}
            </span>
          </div>
          <KitIcon name="star" size={s(18)} color={BR.dim} />
          <KitIcon name="moreVertical" size={s(18)} color={BR.dim} />
          {/* loading progress rule */}
          {loading && (
            <div style={{ position: 'absolute', left: 0, bottom: -1, height: s(3), width: `${progress * 100}%`, background: t.accent }} />
          )}
        </div>
        {/* page stack (painter's order: later pages cover earlier) */}
        <div style={{ position: 'absolute', top: TAB_H + NAV_H, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: '#ffffff' }}>
          {revealed.map((g, i) => {
            const p = pages[g.page];
            if (!p) return null;
            const start = revealFrame(g);
            const next = gos.find((n) => n.at > g.at);
            const end = next ? revealFrame(next) : durationInFrames;
            const drift = interpolate(frame, [start, Math.max(start + 1, end)], [1, 1 + (p.drift ?? 0.015)], CLAMP);
            const scrollY = scrollAt(g.page);
            return (
              <div key={`${g.at}-${i}`} style={{ position: 'absolute', top: 0, left: 0, width: region.w, height: region.h, overflow: 'hidden', background: p.bg ?? '#ffffff' }}>
                <div style={{ width: '100%', transform: `translateY(${-scrollY}px) scale(${drift})`, transformOrigin: '50% 20%' }}>
                  {p.node ?? (p.src ? <Img src={p.src} style={{ width: '100%', height: 'auto', display: 'block' }} /> : null)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* click ripples */}
      {clicks.map((cf) => {
        if (frame < cf || frame > cf + 18) return null;
        const at = sampleCursor(cf, cursor);
        const sc = interpolate(frame, [cf, cf + 18], [0, 2.4], { ...CLAMP, easing: EASINGS.easeOut });
        const ro = interpolate(frame, [cf, cf + 18], [0.5, 0], CLAMP);
        return (
          <div key={cf} style={{ position: 'absolute', left: region.x + at.x * region.w, top: region.y + at.y * region.h, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: '50%', border: `2px solid ${t.accent}`, opacity: ro * winOp, transform: `scale(${sc})`, pointerEvents: 'none' }} />
        );
      })}
      {/* the pointer */}
      {cursor.length > 0 && (
        <div style={{ position: 'absolute', left: region.x + cur.x * region.w, top: region.y + cur.y * region.h, transform: 'translate(-4px, -3px)', opacity: winOp }}>
          <CursorPointer press={press} />
        </div>
      )}
    </>
  );
};

/** Marker: animated highlighter sweep behind inline text (left→right at `start`). */
export const Marker: React.FC<{ start: number; color?: string; children: React.ReactNode; pad?: number; radius?: number; theme?: Partial<KitTheme> }> =
  ({ start, color, children, pad = 4, radius = 5, theme }) => {
    const frame = useCurrentFrame();
    const t = resolveTheme(theme);
    const sweep = interpolate(frame, [start, start + 16], [0, 1], { ...CLAMP, easing: EASINGS.easeInOut });
    return (
      <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
        <span style={{ position: 'absolute', left: -pad, right: -pad, top: -2, bottom: -2, background: color ?? `${t.warn}99`, borderRadius: radius, transform: `scaleX(${sweep})`, transformOrigin: 'left', zIndex: 0 }} />
        <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      </span>
    );
  };

/** Ring: animated attention ring around a block (fades in + settles). */
export const Ring: React.FC<{ start: number; color?: string; style?: React.CSSProperties; theme?: Partial<KitTheme> }> = ({ start, color, style, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const op = interpolate(frame, [start, start + 12], [0, 1], { ...CLAMP, easing: EASINGS.easeOut });
  const sc = interpolate(frame, [start, start + 16], [1.06, 1], { ...CLAMP, easing: EASINGS.easeOut });
  return (
    <div style={{ position: 'absolute', inset: -8, border: `3px solid ${color ?? t.accent}`, borderRadius: 12, opacity: op, transform: `scale(${sc})`, pointerEvents: 'none', ...style }} />
  );
};
