import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import type {
  CaptionConfigPanelProps,
  CaptionTemplateProps,
  KaraokeSettings,
} from '../types';
import { ColorField, NumberField } from './config-primitives';
import { getWordTimings } from './word-timing';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 56;

function rgbaFromHex(hex: string, opacity: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0, 0, 0, ${opacity})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function KaraokeCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<KaraokeSettings>) {
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

  // Real word timestamps when available; character-distribution fallback
  // otherwise. The fallback used to live inline here as `splitSegmentIntoWords`.
  const words = getWordTimings(activeSegment);

  const segmentStartFrame = Math.floor(activeSegment.start * fps);
  const segmentEndFrame = Math.floor(activeSegment.end * fps);
  const localFrame = frame - segmentStartFrame;
  const segmentDuration = segmentEndFrame - segmentStartFrame;

  const fadeInOpacity = interpolate(localFrame, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOutOpacity = interpolate(
    localFrame,
    [segmentDuration - 6, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const { activeColor, pastColor, futureColor, backgroundColor, backgroundOpacity } = style;

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
          padding: backgroundOpacity > 0 ? '12px 24px' : '0',
          borderRadius: 8,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.3em',
          maxWidth: '80%',
          opacity,
        }}
      >
        {words.map((word, index) => {
          const isActive = currentTime >= word.start && currentTime < word.end;
          const isPast = currentTime >= word.end;

          const highlightProgress = isActive
            ? interpolate(currentTime, [word.start, word.end], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 0;

          const color = isActive ? activeColor : isPast ? pastColor : futureColor;

          return (
            <span
              key={`${index}-${word.text}`}
              style={{
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize,
                fontWeight: 700,
                color,
                transform: isActive ? `scale(${1 + highlightProgress * 0.1})` : 'scale(1)',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                transition: 'color 0.1s ease',
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

export function KaraokeConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<KaraokeSettings>) {
  const set = <K extends keyof KaraokeSettings>(key: K, value: KaraokeSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-[8px]">
      <ColorField label="Active word" value={settings.activeColor} onChange={(v) => set('activeColor', v)} />
      <ColorField label="Past words" value={settings.pastColor} onChange={(v) => set('pastColor', v)} />
      <ColorField label="Future words" value={settings.futureColor} onChange={(v) => set('futureColor', v)} />
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
        helper="0 = no background pill"
      />
    </div>
  );
}
