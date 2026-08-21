// @vidtsx/kit — TerminalWindow: dark terminal replay. Lines appear on their
// own frame cue and the view auto-tails (last `rows` stay visible), so a long
// run reads like a live session, not a wall of text.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, DARK, resolveTheme, type KitTheme } from './theme';
import { GenericWindow } from './window';

/** [frame the line appears, text, color role] */
export type TermLine = readonly [at: number, text: string, color?: 'dim' | 'text' | 'ok' | 'err' | 'accent'];

export const TerminalWindow: React.FC<{
  title: string;
  lines: readonly TermLine[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  appearAt?: number;
  /** Visible line count before the view starts tailing (default 19). */
  rows?: number;
  size?: number;
  lineH?: number;
  /** Blinking caret at the tail until this frame (a "still running" stall). */
  cursorUntil?: number;
  theme?: Partial<KitTheme>;
}> = ({ title, lines, x = 120, y = 150, w = 1680, h = 820, appearAt = 0, rows = 19, size = 22, lineH = 38, cursorUntil, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const colors = { dim: DARK.d400, text: DARK.d300, ok: t.ok, err: t.danger, accent: t.accent } as const;
  const view = lines.filter((l) => frame >= l[0]).slice(-rows);
  const cursorOn = cursorUntil !== undefined && frame < cursorUntil && Math.floor(frame / 14) % 2 === 0;
  return (
    <GenericWindow title={title} x={x} y={y} w={w} h={h} appearAt={appearAt} variant="dark" theme={theme}>
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 18,
          width: w - 60,
          fontFamily: t.fontMono,
          fontSize: size,
          lineHeight: `${lineH}px`,
          whiteSpace: 'pre',
        }}
      >
        {view.map((l, i) => (
          <div
            key={`${l[0]}-${i}`}
            style={{ color: colors[l[2] ?? 'text'], opacity: interpolate(frame, [l[0], l[0] + 6], [0, 1], CLAMP) }}
          >
            {l[1]}
          </div>
        ))}
        {cursorOn && <span style={{ color: colors.accent }}>▌</span>}
      </div>
    </GenericWindow>
  );
};
