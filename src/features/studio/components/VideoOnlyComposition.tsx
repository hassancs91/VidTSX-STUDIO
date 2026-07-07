import { AbsoluteFill, Video } from 'remotion';

export interface VideoOnlyCompositionProps {
  videoUrl: string;
}

export function VideoOnlyComposition({ videoUrl }: VideoOnlyCompositionProps) {
  return (
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
  );
}
