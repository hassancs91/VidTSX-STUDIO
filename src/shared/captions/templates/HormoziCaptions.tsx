import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type {
  CaptionConfigPanelProps,
  CaptionTemplateProps,
  HormoziSettings,
} from '../types';
import { ColorField, NumberField, SelectField } from './config-primitives';
import { getWordTimings } from './word-timing';
import { resolveSegmentSettings } from './resolve-overrides';

const BASE_FONT_SIZE = 72;

function buildTextShadow(strokeColor: string, strokeWidth: number): string {
  if (strokeWidth <= 0) return 'none';
  // 8-direction stroke (the standard "fake outline" CSS trick).
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

// Decide which token indices get the accent colour given the settings.
function accentIndices(tokens: string[], settings: HormoziSettings): Set<number> {
  const accents = new Set<number>();
  if (settings.accentMode === 'none' || tokens.length === 0) return accents;

  if (settings.accentMode === 'every-nth') {
    const n = Math.max(1, Math.floor(settings.accentEveryN));
    for (let i = n - 1; i < tokens.length; i += n) accents.add(i);
    return accents;
  }

  // 'longest' — find the token with the most alpha characters; ties go to the
  // earliest. Strip punctuation when measuring so "incredible!" beats "fact".
  let bestIdx = 0;
  let bestLen = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const len = tokens[i].replace(/[^\p{L}\p{N}]/gu, '').length;
    if (len > bestLen) {
      bestLen = len;
      bestIdx = i;
    }
  }
  accents.add(bestIdx);
  return accents;
}

export function HormoziCaptions({
  segments,
  baseSettings,
  styleSettings,
  styleId,
}: CaptionTemplateProps<HormoziSettings>) {
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

  const tokens = words.map((w) => w.text);
  const accentSet = accentIndices(tokens, style);
  const fontSize = BASE_FONT_SIZE * base.fontSize;
  const { textColor, strokeColor, strokeWidth, uppercase, accentColor, perWordPop } = style;
  const textShadow = buildTextShadow(strokeColor, strokeWidth);

  // Whole-segment fade so we don't see hard pop-out at the end. Per-word pop
  // is layered on top via the `wordScale` below.
  const segmentStartFrame = Math.floor(activeSegment.start * fps);
  const segmentEndFrame = Math.floor(activeSegment.end * fps);
  const localFrame = frame - segmentStartFrame;
  const segmentDuration = segmentEndFrame - segmentStartFrame;
  const fadeIn = interpolate(localFrame, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(
    localFrame,
    [segmentDuration - 6, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${base.position.x}%`,
          top: `${base.position.y}%`,
          transform: 'translate(-50%, -50%)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Impact, sans-serif',
          fontSize,
          fontWeight: 900,
          letterSpacing: '0.01em',
          textAlign: 'center',
          textShadow,
          opacity,
          maxWidth: '85%',
          lineHeight: 1.1,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.25em',
          textTransform: uppercase ? 'uppercase' : 'none',
        }}
      >
        {words.map((word, i) => {
          // Per-word pop: each word springs from 0 at its own start time.
          const wordStartFrame = Math.floor(word.start * fps);
          const wordLocalFrame = frame - wordStartFrame;
          const wordScale = perWordPop > 0
            ? spring({
                frame: wordLocalFrame,
                fps,
                config: { damping: 10, stiffness: 220, mass: 0.55 },
                from: 1 - 0.4 * perWordPop,
                to: 1,
              })
            : 1;
          const visible = currentTime >= word.start - 0.05;
          const wordOpacity = visible ? 1 : 0;
          const color = accentSet.has(i) ? accentColor : textColor;
          return (
            <span
              key={`${i}-${word.text}`}
              style={{
                color,
                display: 'inline-block',
                transform: `scale(${wordScale})`,
                opacity: wordOpacity,
                transition: 'opacity 0.05s linear',
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

export function HormoziConfigPanel({
  settings,
  onChange,
}: CaptionConfigPanelProps<HormoziSettings>) {
  const set = <K extends keyof HormoziSettings>(key: K, value: HormoziSettings[K]) =>
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
      <SelectField
        label="Accent"
        value={settings.accentMode}
        options={[
          { value: 'longest', label: 'Longest' },
          { value: 'every-nth', label: 'Every N' },
          { value: 'none', label: 'None' },
        ]}
        onChange={(v) => set('accentMode', v)}
      />
      {settings.accentMode === 'every-nth' && (
        <NumberField
          label="N (every Nth word)"
          min={1}
          max={10}
          step={1}
          value={settings.accentEveryN}
          onChange={(v) => set('accentEveryN', v)}
        />
      )}
      {settings.accentMode !== 'none' && (
        <ColorField
          label="Accent color"
          value={settings.accentColor}
          onChange={(v) => set('accentColor', v)}
        />
      )}
      <NumberField
        label="Per-word pop"
        min={0}
        max={1}
        step={0.05}
        value={settings.perWordPop}
        onChange={(v) => set('perWordPop', v)}
        helper="0 = no bounce, 1 = signature Hormozi bounce"
      />
    </div>
  );
}
