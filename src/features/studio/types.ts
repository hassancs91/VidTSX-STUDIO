import type {
  VideoMetadata,
  StudioComposition,
  StudioProjectData,
  LayerTransform,
  StudioEffect,
  StudioClipTransition,
  StudioClipAnimation,
  StudioTextStyle,
} from '@shared/ipc/types';

export type { VideoMetadata, StudioComposition, StudioProjectData };

export interface StudioTrack {
  id: string;
  label: string;
  type: 'video' | 'image' | 'text' | 'captions' | 'tsx' | 'sfx' | 'music';
  color: string;
}

export interface StudioVideo {
  filePath: string;
  fileName: string;
  videoUrl: string;
  metadata: VideoMetadata;
}

export type SelectableTrackType = 'video' | 'tsx' | 'captions' | 'image' | 'text' | 'sfx' | 'music';

export interface SelectedClip {
  trackType: SelectableTrackType;
  id: string;
}

// Snapshot of a clip's copyable look — captured by "Copy attributes" and
// applied to other clips by "Paste attributes". Each field is captured only
// when the source clip's TYPE supports it; pasting applies the subset the
// target type supports. For the nullable fields, `null` means "captured but
// none" (so paste resets the target), while `undefined`/absent means "not
// captured" (paste leaves the target's value alone).
export interface CopiedClipAttributes {
  sourceTrackType: SelectableTrackType;
  transform?: LayerTransform | null;
  effects?: StudioEffect[] | null;
  transitionIn?: StudioClipTransition | null;
  transitionOut?: StudioClipTransition | null;
  animations?: StudioClipAnimation[] | null;
  volume?: number;
  muted?: boolean;
  style?: StudioTextStyle;
}

// The selectable groups in the "Paste attributes" chooser. Kept as a small,
// explicit union so the modal + apply logic stay in lockstep and new groups
// (e.g. a future 'colour' or 'audioFx') slot in cleanly.
export type PasteAttributeCategory =
  | 'transform'
  | 'effects'
  | 'transitions'
  | 'animations'
  | 'volume'
  | 'muted'
  | 'style';

// Which target track types can receive each category (used to grey out groups
// that none of the selected clips support).
export const PASTE_CATEGORY_TARGETS: Record<PasteAttributeCategory, SelectableTrackType[]> = {
  transform: ['video', 'image', 'text', 'tsx'],
  effects: ['video'],
  transitions: ['video'],
  animations: ['video', 'image', 'text'],
  volume: ['video', 'sfx', 'music'],
  muted: ['video'],
  style: ['text'],
};

// Display order + labels for the chooser.
export const PASTE_CATEGORY_META: { key: PasteAttributeCategory; label: string }[] = [
  { key: 'transform', label: 'Transform (position, size, rotation)' },
  { key: 'effects', label: 'Effects' },
  { key: 'transitions', label: 'Transitions' },
  // Animations hidden for this release (see ControlPanel TABS). The category,
  // copy/apply wiring, and PASTE_CATEGORY_TARGETS stay intact — uncomment to show.
  // { key: 'animations', label: 'Animations' },
  { key: 'volume', label: 'Volume' },
  { key: 'muted', label: 'Mute' },
  { key: 'style', label: 'Text style' },
];

export interface StudioProject {
  composition: StudioComposition;
  video?: StudioVideo;
}

export type StudioStatus = 'list' | 'loading' | 'ready' | 'error';

export const STUDIO_TRACKS: StudioTrack[] = [
  { id: 'video', label: 'Video', type: 'video', color: '#7F77DD' },
  { id: 'image', label: 'Image', type: 'image', color: '#C9A0FF' },
  { id: 'text', label: 'Text', type: 'text', color: '#E8C468' },
  { id: 'tsx', label: 'TSX', type: 'tsx', color: '#5DCAA5' },
  { id: 'captions', label: 'Captions', type: 'captions', color: '#EF9F27' },
  { id: 'sfx', label: 'SFX', type: 'sfx', color: '#F09595' },
  // 'music' track kind kept internally for back-compat; labelled "Audio" since
  // it holds voice-overs, soundtracks, and any non-SFX audio.
  { id: 'music', label: 'Audio', type: 'music', color: '#85B7EB' },
];
