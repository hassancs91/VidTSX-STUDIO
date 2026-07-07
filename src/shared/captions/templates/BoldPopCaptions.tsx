import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type {
  BoldPopSettings,
  CaptionConfigPanelProps,
  CaptionTemplateProps,
} from '../types';
import { ColorField, NumberField } from './config-primitives';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 72;

export function BoldPopCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<BoldPopSettings>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );
  if (!activeSegment) return <AbsoluteFill />;

  // Merge per-segment overrides for the active style — every value below is
  // read off `base` / `style` instead of the props directly.
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

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
    from: 0.8,
    to: 1,
  });

  const fadeInOpacity = interpolate(localFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOutOpacity = interpolate(
    localFrame,
    [segmentDuration - 8, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  const { strokeWidth, strokeColor, textColor, highlightEveryN, highlightColor } = style;
  const textShadow = `
    ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor},
    -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor},
    ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor},
    -${strokeWidth}px -${strokeWidth}px 0 ${strokeColor},
    ${strokeWidth}px 0 0 ${strokeColor},
    -${strokeWidth}px 0 0 ${strokeColor},
    0 ${strokeWidth}px 0 ${strokeColor},
    0 -${strokeWidth}px 0 ${strokeColor}
  `;

  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const tokens = activeSegment.text.trim().split(/\s+/).filter(Boolean);
  const shouldHighlight = highlightEveryN > 0;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${base.position.x}%`,
          top: `${base.position.y}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize,
          fontWeight: 800,
          textAlign: 'center',
          textShadow,
          opacity,
          maxWidth: '80%',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.1,
        }}
      >
        {shouldHighlight
          ? tokens.map((token, i) => {
              const isAccent = (i + 1) % highlightEveryN === 0;
              return (
                <span
                  key={`${i}-${token}`}
                  style={{ color: isAccent ? highlightColor : textColor }}
                >
                  {token}
                  {i < tokens.length - 1 ? ' ' : ''}
                </span>
              );
            })
          : <span style={{ color: textColor }}>{activeSegment.text}</span>}
      </div>
    </AbsoluteFill>
  );
}

export function BoldPopConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<BoldPopSettings>) {
  const set = <K extends keyof BoldPopSettings>(key: K, value: BoldPopSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-[8px]">
      <ColorField label="Text color" value={settings.textColor} onChange={(v) => set('textColor', v)} />
      <ColorField label="Stroke color" value={settings.strokeColor} onChange={(v) => set('strokeColor', v)} />
      <NumberField
        label="Stroke width"
        suffix="px"
        min={0}
        max={12}
        step={1}
        value={settings.strokeWidth}
        onChange={(v) => set('strokeWidth', v)}
      />
      <NumberField
        label="Highlight every N words"
        helper="0 disables the accent"
        min={0}
        max={10}
        step={1}
        value={settings.highlightEveryN}
        onChange={(v) => set('highlightEveryN', v)}
      />
      {settings.highlightEveryN > 0 && (
        <ColorField
          label="Highlight color"
          value={settings.highlightColor}
          onChange={(v) => set('highlightColor', v)}
        />
      )}
    </div>
  );
}

