import { AbsoluteFill, Video } from 'remotion';
import type { TranscriptSegment } from '@shared/ipc/types';
import type { CaptionStyleId, CaptionBaseSettings } from '../types';
import { getStyleDefinition, resolveStyleSettings } from './index';

export interface CaptionPreviewCompositionProps {
  segments: TranscriptSegment[];
  styleId: CaptionStyleId;
  videoUrl?: string;
  baseSettings: CaptionBaseSettings;
  // Per-style configs keyed by styleId. The composition resolves the active
  // style's blob against its declared defaults before rendering.
  styleConfigs?: Record<string, unknown>;
}

export function CaptionPreviewComposition({
  segments,
  styleId,
  videoUrl,
  baseSettings,
  styleConfigs,
}: CaptionPreviewCompositionProps) {
  const styleDef = getStyleDefinition(styleId);
  if (!styleDef) return <AbsoluteFill />;
  const styleSettings = resolveStyleSettings(styleId, styleConfigs);

  return (
    <AbsoluteFill>
      {videoUrl && (
        <AbsoluteFill>
          <Video
            src={videoUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </AbsoluteFill>
      )}
      <styleDef.Component
        segments={segments}
        baseSettings={baseSettings}
        styleSettings={styleSettings}
        styleId={styleId}
      />
    </AbsoluteFill>
  );
}
