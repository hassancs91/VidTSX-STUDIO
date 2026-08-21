// @vidtsx/kit — AgentFeed + AgentInputDock: a streaming AI-agent session in
// the familiar CLI grammar (accent ⏺ tool lines, dim ⎿ results, a pulsing ✳
// spinner) plus the composer dock. Product-neutral: no vendor names or logos —
// the caller decides whose agent this is via labels and theme.
// Designed to sit on a dark editor/terminal surface (VSCodeWindow group or
// GenericWindow dark).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, resolveTheme, type KitTheme } from './theme';
import { KitIcon } from './icons';

const SURFACE = { text: '#cccccc', dim: '#8b8b8b', faint: '#6e6e6e', input: '#242424', inputBorder: '#3a3a3a' } as const;

/** [frame the line appears, kind, text] — 'tool' gets the accent ⏺, the rest ⎿. */
export type FeedLine = readonly [at: number, kind: 'tool' | 'sub' | 'ok' | 'err', text: string];

export const AgentFeed: React.FC<{
  lines: readonly FeedLine[];
  x: number;
  w: number;
  top: number;
  /** Visible line count before the view starts tailing (default 12). */
  rows?: number;
  size?: number;
  lineH?: number;
  /** Pulsing "working" line pinned after the feed. */
  spinner?: { label: string; from: number; until?: number };
  theme?: Partial<KitTheme>;
}> = ({ lines, x, w, top, rows = 12, size = 20, lineH = 40, spinner, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const colors = { tool: SURFACE.text, sub: SURFACE.dim, ok: t.ok, err: t.danger } as const;
  const shown = lines.filter((l) => frame >= l[0]).slice(-rows);
  const spinOn = spinner && frame >= spinner.from && (spinner.until === undefined || frame < spinner.until);
  const pulse = 0.55 + 0.45 * Math.abs(((frame % 36) / 18) - 1);
  return (
    <div style={{ position: 'absolute', top, left: x + 28, width: w - 56, fontFamily: t.fontMono, fontSize: size, lineHeight: `${lineH}px` }}>
      {shown.map((l, i) => (
        <div key={`${l[0]}-${i}`} style={{ display: 'flex', gap: 10, color: colors[l[1]], opacity: interpolate(frame, [l[0], l[0] + 6], [0, 1], CLAMP), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: l[1] === 'tool' ? t.accent : l[1] === 'ok' ? t.ok : l[1] === 'err' ? t.danger : SURFACE.faint, flexShrink: 0 }}>
            {l[1] === 'tool' ? '⏺' : '⎿'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l[2]}</span>
        </div>
      ))}
      {spinOn && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: t.accent, opacity: pulse }}>
          <span>✳</span>
          <span style={{ color: SURFACE.dim, fontFamily: t.fontBody, fontSize: size - 1 }}>
            {spinner.label} <span style={{ color: SURFACE.faint }}>(esc to interrupt)</span>
          </span>
        </div>
      )}
    </div>
  );
};

/** The agent composer: text row (placeholder / typed / queued), then the
 *  control row (+, /, mode, send). Pass `typed` as a node so TypedText or
 *  highlighted phrases can render mid-prompt. */
export const AgentInputDock: React.FC<{
  x: number;
  w: number;
  typed?: React.ReactNode;
  /** After send: queued placeholder + stop button. */
  sent?: boolean;
  placeholder?: string;
  modeLabel?: string;
  bottom?: number;
  theme?: Partial<KitTheme>;
}> = ({ x, w, typed, sent = false, placeholder = 'Describe what to build…', modeLabel = 'Auto mode', bottom = 28, theme }) => {
  const t = resolveTheme(theme);
  return (
    <div style={{ position: 'absolute', bottom, left: x + 20, width: w - 40 }}>
      <div style={{ background: SURFACE.input, border: `1px solid ${sent ? SURFACE.inputBorder : t.accent}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '18px 22px', minHeight: 30 }}>
          {sent ? (
            <span style={{ flex: 1, color: SURFACE.faint, fontSize: 24 }}>Queue another message…</span>
          ) : typed ? (
            <span style={{ flex: 1, color: SURFACE.text, fontFamily: t.fontMono, fontSize: 24, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{typed}</span>
          ) : (
            <span style={{ flex: 1, color: SURFACE.faint, fontSize: 24 }}>{placeholder}</span>
          )}
          <KitIcon name="mic" size={23} color={SURFACE.dim} strokeWidth={2} style={{ marginTop: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <KitIcon name="plus" size={25} color={SURFACE.dim} strokeWidth={2} />
            <div style={{ width: 34, height: 29, borderRadius: 8, border: `1px solid ${SURFACE.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KitIcon name="slash" size={17} color={SURFACE.dim} strokeWidth={2} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <KitIcon name="zap" size={19} color={SURFACE.dim} strokeWidth={2} />
            <span style={{ color: SURFACE.dim, fontSize: 22 }}>{modeLabel}</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: sent ? SURFACE.input : t.accent, border: sent ? `1px solid ${SURFACE.inputBorder}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {sent
                ? <KitIcon name="square" size={16} color={SURFACE.text} fill />
                : <KitIcon name="arrowUp" size={23} color="#fff" strokeWidth={2.4} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
