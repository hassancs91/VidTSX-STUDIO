import type { StudioClip } from '../../types';
import { FloatingMenu } from './FloatingMenu';

interface Props {
  x: number;
  y: number;
  clip: StudioClip;
  /** False when the clip's asset is known to carry no audio track. */
  assetHasAudio: boolean;
  onDetachAudio: (clip: StudioClip) => void;
  onClose: () => void;
}

/** Right-click menu for a timeline clip. Video-only for now (detach audio);
 *  future clip actions land here rather than growing TimelinePanel. */
export function ClipContextMenu({ x, y, clip, assetHasAudio, onDetachAudio, onClose }: Props) {
  return (
    <FloatingMenu
      x={x}
      y={y}
      items={[
        {
          id: 'detach-audio',
          label: 'Detach audio',
          disabled: (clip.gain ?? 1) === 0 || !assetHasAudio,
        },
      ]}
      onPick={(id) => {
        if (id === 'detach-audio') onDetachAudio(clip);
      }}
      onClose={onClose}
    />
  );
}
