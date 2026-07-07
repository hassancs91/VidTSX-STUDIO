import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import type {
  CaptionConfigPanelProps,
  CaptionTemplateProps,
  MinimalSettings,
} from '../types';
import { ColorField, SelectField } from './config-primitives';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 32;

export function MinimalCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<MinimalSettings>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );
  if (!activeSegment) return <AbsoluteFill />;

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

  const fadeInOpacity = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOutOpacity = interpolate(
    localFrame,
    [segmentDuration - 5, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const { background, backgroundColor, textColor } = style;
  const bgOpacity = background === 'translucent' ? 0.7 : background === 'solid' ? 1 : 0;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${base.position.x}%`,
          top: `${base.position.y}%`,
          transform: 'translate(-50%, -50%)',
          opacity,
        }}
      >
        <div
          style={{
            position: 'relative',
            padding: background === 'none' ? '0' : '8px 20px',
            maxWidth: '70vw',
          }}
        >
          {bgOpacity > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor,
                opacity: bgOpacity,
                borderRadius: 4,
              }}
            />
          )}
          <span
            style={{
              position: 'relative',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize,
              fontWeight: 400,
              color: textColor,
              textAlign: 'center',
              lineHeight: 1.4,
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {activeSegment.text}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function MinimalConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<MinimalSettings>) {
  const set = <K extends keyof MinimalSettings>(key: K, value: MinimalSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-[8px]">
      <ColorField label="Text color" value={settings.textColor} onChange={(v) => set('textColor', v)} />
      <SelectField
        label="Background"
        value={settings.background}
        options={[
          { value: 'none', label: 'None' },
          { value: 'translucent', label: 'Translucent' },
          { value: 'solid', label: 'Solid' },
        ]}
        onChange={(v) => set('background', v)}
      />
      {settings.background !== 'none' && (
        <ColorField
          label="Background color"
          value={settings.backgroundColor}
          onChange={(v) => set('backgroundColor', v)}
        />
      )}
    </div>
  );
}
