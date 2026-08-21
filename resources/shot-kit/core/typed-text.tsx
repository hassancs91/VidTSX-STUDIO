// @vidtsx/kit — TypedText: character-by-character write-on with a blinking
// block caret. The one typing idiom every chrome shares (address bars, prompts,
// terminal input); eased so the pacing breathes instead of ticking.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, resolveTheme, type KitTheme } from './theme';
import { EASINGS } from './easings';

/** Frames the type-on takes — schedule follow-up beats at start + typeDuration(text). */
export const typeDuration = (text: string, perChar = 1.3): number => Math.ceil(text.length * perChar);

export const TypedText: React.FC<{
  text: string;
  /** Frame typing starts. Pass a negative start to render fully typed. */
  start: number;
  /** Frames per character (default 1.3). */
  perChar?: number;
  /** Blinking block caret while typing (default true). */
  caret?: boolean;
  caretColor?: string;
  /** Hide the caret from this frame on (e.g. the "send"/"enter" beat). */
  doneAt?: number;
  style?: React.CSSProperties;
  theme?: Partial<KitTheme>;
}> = ({ text, start, perChar = 1.3, caret = true, caretColor, doneAt, style, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const end = start + typeDuration(text, perChar);
  const shown = Math.floor(
    interpolate(frame, [start, end], [0, text.length], { ...CLAMP, easing: EASINGS.easeInOut }),
  );
  const done = doneAt !== undefined && frame >= doneAt;
  const caretOn = caret && !done && Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={{ whiteSpace: 'pre-wrap', ...style }}>
      {text.slice(0, shown)}
      {caret && (
        <span style={{ opacity: caretOn ? 1 : 0, color: caretColor ?? t.accent }}>▌</span>
      )}
    </span>
  );
};
