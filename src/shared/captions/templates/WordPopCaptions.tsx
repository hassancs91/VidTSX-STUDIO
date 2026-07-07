import { useCurrentFrame, useVideoConfig, spring, AbsoluteFill } from 'remotion';
import type {
  CaptionConfigPanelProps,
  CaptionTemplateProps,
  WordPopSettings,
} from '../types';
import { ColorField, NumberField, SelectField } from './config-primitives';
import { getWordTimings, type WordTiming } from './word-timing';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 120;

function buildStroke(strokeColor: string, strokeWidth: number): string {
  if (strokeWidth <= 0) return 'none';
  return [
    `${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}`,
    `-${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}`,
    `${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}`,
    `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}`,
    `${strokeWidth}px 0 0 ${strokeColor}`,
    `-${strokeWidth}px 0 0 ${strokeColor}`,
    `0 ${strokeWidth}px 0 ${strokeColor}`,
    `0 -${strokeWidth}px 0 ${strokeColor}`,
  ].join(', ');
}

export function WordPopCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<WordPopSettings>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find the segment AND, within it, the currently-spoken word. We tolerate a
  // small slop so words don't flicker out a frame before the next one starts.
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  // Merge per-segment overrides for the active style. Done before we use any
  // style fields (e.g. `betweenWords`) so per-segment behaviour kicks in too.
  const { baseSettings: base, styleSettings: style } = resolveSegmentSettings(
    activeSegment,
    styleId,
    baseSettings,
    styleSettings,
  );

  let displayed: WordTiming | null = null;
  if (activeSegment) {
    const words = getWordTimings(activeSegment);
    const current = words.find((w) => currentTime >= w.start && currentTime < w.end);
    if (current) {
      displayed = current;
    } else if (style.betweenWords === 'last') {
      // Hold the most recently-finished word until the next one starts.
      const past = [...words].reverse().find((w) => w.end <= currentTime);
      if (past) displayed = past;
    }
  }

  if (!displayed) return <AbsoluteFill />;

  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const { textColor, strokeColor, strokeWidth, uppercase, bounciness } = style;
  const textShadow = buildStroke(strokeColor, strokeWidth);

  // Per-word spring entry. Bounciness 0 = stiff (snap in), 2 = very bouncy.
  const wordStartFrame = Math.floor(displayed.start * fps);
  const localFrame = frame - wordStartFrame;
  const damping = Math.max(6, 18 - 8 * bounciness);
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping, stiffness: 220, mass: 0.5 },
    from: 0.6,
    to: 1,
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${base.position.x}%`,
          top: `${base.position.y}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Impact, sans-serif',
          fontSize,
          fontWeight: 900,
          letterSpacing: '0.02em',
          color: textColor,
          textShadow,
          textAlign: 'center',
          maxWidth: '90%',
          lineHeight: 1.1,
          textTransform: uppercase ? 'uppercase' : 'none',
        }}
      >
        {displayed.text}
      </div>
    </AbsoluteFill>
  );
}

export function WordPopConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<WordPopSettings>) {
  const set = <K extends keyof WordPopSettings>(key: K, value: WordPopSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-[8px]">
      <ColorField label="Text color" value={settings.textColor} onChange={(v) => set('textColor', v)} />
      <ColorField label="Stroke color" value={settings.strokeColor} onChange={(v) => set('strokeColor', v)} />
      <NumberField
        label="Stroke width"
        suffix="px"
        min={0}
        max={14}
        step={1}
        value={settings.strokeWidth}
        onChange={(v) => set('strokeWidth', v)}
      />
      <SelectField
        label="Uppercase"
        value={settings.uppercase ? 'on' : 'off'}
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ]}
        onChange={(v) => set('uppercase', v === 'on')}
      />
      <NumberField
        label="Bounciness"
        min={0}
        max={2}
        step={0.1}
        value={settings.bounciness}
        onChange={(v) => set('bounciness', v)}
        helper="0 = snap in, 2 = wobble"
      />
      <SelectField
        label="Between words"
        value={settings.betweenWords}
        options={[
          { value: 'hide', label: 'Hide' },
          { value: 'last', label: 'Hold last' },
        ]}
        onChange={(v) => set('betweenWords', v)}
      />
    </div>
  );
}
