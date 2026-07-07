import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import type {
  CaptionConfigPanelProps,
  CaptionTemplateProps,
  HighlightBoxSettings,
} from '../types';
import { ColorField, NumberField, SelectField } from './config-primitives';
import { getWordTimings } from './word-timing';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 60;

function rgbaFromHex(hex: string, opacity: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0, 0, 0, ${opacity})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${opacity})`;
}

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

export function HighlightBoxCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<HighlightBoxSettings>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );
  if (!activeSegment) return <AbsoluteFill />;

  const words = getWordTimings(activeSegment);
  if (words.length === 0) return <AbsoluteFill />;

  const { baseSettings: base, styleSettings: style } = resolveSegmentSettings(
    activeSegment,
    styleId,
    baseSettings,
    styleSettings,
  );

  const segmentStartFrame = Math.floor(activeSegment.start * fps);
  const segmentEndFrame = Math.floor(activeSegment.end * fps);
  const localFrame = frame - segmentStartFrame;
  const segmentDuration = segmentEndFrame - segmentStartFrame;
  const fadeIn = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(
    localFrame,
    [segmentDuration - 6, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const {
    textColor,
    activeTextColor,
    highlightColor,
    strokeColor,
    strokeWidth,
    backgroundColor,
    backgroundOpacity,
    uppercase,
  } = style;
  const textShadow = buildStroke(strokeColor, strokeWidth);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${base.position.x}%`,
          top: `${base.position.y}%`,
          transform: 'translate(-50%, -50%)',
          backgroundColor:
            backgroundOpacity > 0 ? rgbaFromHex(backgroundColor, backgroundOpacity) : 'transparent',
          padding: backgroundOpacity > 0 ? '14px 24px' : '0',
          borderRadius: 10,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.25em',
          maxWidth: '82%',
          opacity,
          textTransform: uppercase ? 'uppercase' : 'none',
        }}
      >
        {words.map((word, index) => {
          const isActive = currentTime >= word.start && currentTime < word.end;
          const color = isActive ? activeTextColor : textColor;
          return (
            <span
              key={`${index}-${word.text}`}
              style={{
                position: 'relative',
                display: 'inline-block',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize,
                fontWeight: 800,
                color,
                textShadow,
                padding: '0.05em 0.18em',
                borderRadius: 6,
                // Painted directly on the span; transitions between adjacent
                // active words feel like the box "slides" across the line.
                backgroundColor: isActive ? highlightColor : 'transparent',
                transition: 'background-color 0.05s linear, color 0.05s linear',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export function HighlightBoxConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<HighlightBoxSettings>) {
  const set = <K extends keyof HighlightBoxSettings>(key: K, value: HighlightBoxSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-[8px]">
      <ColorField label="Text color" value={settings.textColor} onChange={(v) => set('textColor', v)} />
      <ColorField
        label="Highlight color"
        value={settings.highlightColor}
        onChange={(v) => set('highlightColor', v)}
      />
      <ColorField
        label="Active text color"
        value={settings.activeTextColor}
        onChange={(v) => set('activeTextColor', v)}
      />
      <ColorField label="Stroke color" value={settings.strokeColor} onChange={(v) => set('strokeColor', v)} />
      <NumberField
        label="Stroke width"
        suffix="px"
        min={0}
        max={10}
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
      <ColorField
        label="Background"
        value={settings.backgroundColor}
        onChange={(v) => set('backgroundColor', v)}
      />
      <NumberField
        label="Background opacity"
        min={0}
        max={1}
        step={0.05}
        value={settings.backgroundOpacity}
        onChange={(v) => set('backgroundOpacity', v)}
        helper="0 = transparent background"
      />
    </div>
  );
}
