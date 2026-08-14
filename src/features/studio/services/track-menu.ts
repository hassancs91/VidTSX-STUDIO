// The one definition of the track options menu — used by the header's
// right-click/kebab AND the lane-background context menu, so the two can
// never drift apart.

import type { StudioTrack } from '../types';
import type { FloatingMenuItem } from '../components/timeline/FloatingMenu';

export function trackMenuItems(
  track: StudioTrack,
  index: number,
  trackCount: number,
): FloatingMenuItem[] {
  return [
    { id: 'rename', label: 'Rename' },
    { id: 'up', label: 'Move up', disabled: index === 0 },
    { id: 'down', label: 'Move down', disabled: index === trackCount - 1 },
    {
      id: 'delete',
      label: track.clips.length > 0 ? `Delete (${track.clips.length} clips)` : 'Delete',
      disabled: Boolean(track.locked) || trackCount <= 1,
      danger: true,
    },
  ];
}
