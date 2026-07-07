// Builds the StudioRenderInput sent to the main process for final-video export.
//
// This mirrors exactly what StudioScreen feeds the <Player>: visible video
// clips in cut-time, captions remapped to cut-time, and only the `ready` TSX
// overlay slots. Everything here is pure — no React, no IPC — so it stays
// trivially testable against the preview props.
//
// All frame positions are cut-time (hidden clips already collapsed out by
// compressCutClips, captions already remapped by remapCaptionsToCutTime).

import type {
  StudioRenderInput,
  StudioRenderVideoClip,
  StudioRenderAudioClip,
  StudioRenderImageClip,
  StudioRenderTextClip,
  StudioRenderSlot,
  StudioRenderClipAnimation,
  StudioVideoClip,
  StudioAudioClip,
  StudioImageClip,
  StudioTextClip,
  StudioClipAnimation,
  StudioComposition,
  TranscriptSegment,
} from '@shared/ipc/types';
import type { CaptionBaseSettings } from '@shared/captions/types';
import type { SlotRuntime } from '../hooks/useTsxSlots';

export interface StudioRenderCaptionsInput {
  // Cut-time segments — the same list passed to the Player as `segments`.
  segments: TranscriptSegment[];
  styleId: string;
  baseSettings: CaptionBaseSettings;
  styleConfigs?: Record<string, unknown>;
}

export interface BuildStudioRenderInputArgs {
  projectId: string;
  composition: StudioComposition;
  // Visible clips in cut-time (compressCutClips().visibleClips) — carry filePath
  // and cut-time bounds. Empty for a slots-only (empty-canvas) project.
  visibleClips: StudioVideoClip[];
  // Image-track clips (absolute timeline-time, like TSX overlays).
  imageClips: StudioImageClip[];
  // Text-track clips (absolute timeline-time).
  textClips: StudioTextClip[];
  // SFX + Music clips (absolute timeline-time).
  audioClips: StudioAudioClip[];
  // Ready slots only (status === 'ready'). Slots without a written file are
  // dropped defensively.
  readySlots: SlotRuntime[];
  // Captions, or null/undefined when none are configured or the track is hidden.
  captions?: StudioRenderCaptionsInput | null;
}

function maxEndFrame(items: Array<{ startFrame: number; durationInFrames: number }>): number {
  return items.reduce((max, it) => Math.max(max, it.startFrame + it.durationInFrames), 0);
}

// Convert a clip's animation arrows (clip-relative seconds) to the frame-based
// render form, at the edit fps so the export fps-rescale adjusts them like every
// other frame value. Returns undefined when there are none (keeps payload lean).
function toRenderAnimations(
  animations: StudioClipAnimation[] | undefined,
  fps: number
): StudioRenderClipAnimation[] | undefined {
  if (!animations || animations.length === 0) return undefined;
  return animations.map((a) => ({
    preset: a.preset,
    startFrames: Math.round(a.startSeconds * fps),
    durationFrames: Math.max(1, Math.round(a.durationSeconds * fps)),
    from: a.from,
    to: a.to,
    direction: a.direction,
    easing: a.easing,
  }));
}

export function buildStudioRenderInput(args: BuildStudioRenderInputArgs): StudioRenderInput {
  const { projectId, composition, visibleClips, imageClips, textClips, audioClips, readySlots, captions } = args;
  const { fps, width, height } = composition;

  const videoClips: StudioRenderVideoClip[] = visibleClips.map((c) => ({
    id: c.id,
    filePath: c.filePath,
    startFrame: Math.round(c.startTime * fps),
    durationInFrames: Math.round((c.endTime - c.startTime) * fps),
    inPointFrames: Math.round((c.inPointSeconds ?? 0) * fps),
    transform: c.transform,
    muted: c.muted,
    volume: c.volume,
    effects: c.effects,
    // Transitions stored in seconds → frames at the project fps (rescaled later
    // if the export targets a different fps).
    transitionIn: c.transitionIn
      ? { type: c.transitionIn.type, durationInFrames: Math.round(c.transitionIn.durationInSeconds * fps) }
      : undefined,
    transitionOut: c.transitionOut
      ? { type: c.transitionOut.type, durationInFrames: Math.round(c.transitionOut.durationInSeconds * fps) }
      : undefined,
    animations: toRenderAnimations(c.animations, fps),
  }));

  const renderImageClips: StudioRenderImageClip[] = imageClips.map((c) => ({
    id: c.id,
    filePath: c.filePath,
    startFrame: Math.round(c.startTime * fps),
    durationInFrames: Math.round((c.endTime - c.startTime) * fps),
    transform: c.transform,
    animations: toRenderAnimations(c.animations, fps),
  }));

  const renderTextClips: StudioRenderTextClip[] = textClips.map((c) => ({
    id: c.id,
    text: c.text,
    style: c.style,
    startFrame: Math.round(c.startTime * fps),
    durationInFrames: Math.round((c.endTime - c.startTime) * fps),
    transform: c.transform,
    animations: toRenderAnimations(c.animations, fps),
  }));

  const renderAudioClips: StudioRenderAudioClip[] = audioClips.map((c) => ({
    id: c.id,
    filePath: c.filePath,
    startFrame: Math.round(c.startTime * fps),
    durationInFrames: Math.round((c.endTime - c.startTime) * fps),
    inPointFrames: Math.round((c.inPointSeconds ?? 0) * fps),
    volume: c.volume,
  }));

  const slots: StudioRenderSlot[] = readySlots
    .filter((s) => !!s.slot.fileName)
    .map((s) => ({
      id: s.slot.id,
      fileName: s.slot.fileName,
      startFrame: Math.round(s.slot.startTime * fps),
      durationInFrames: Math.round((s.slot.endTime - s.slot.startTime) * fps),
      inPointFrames: Math.round((s.slot.inPointSeconds ?? 0) * fps),
      transform: s.slot.transform,
    }));

  // Output length = the end of the last piece of content (cut video end, or the
  // last overlay/image/audio clip if one extends past the video). No trailing
  // timeline padding. Falls back to the composition's configured length for an
  // empty canvas.
  const contentEndFrames = Math.max(
    maxEndFrame(videoClips),
    maxEndFrame(slots),
    maxEndFrame(renderImageClips),
    maxEndFrame(renderTextClips),
    maxEndFrame(renderAudioClips)
  );
  const durationInFrames =
    contentEndFrames > 0
      ? contentEndFrames
      : Math.round(composition.durationInSeconds * fps);

  return {
    projectId,
    width,
    height,
    fps,
    durationInFrames,
    videoClips,
    audioClips: renderAudioClips,
    imageClips: renderImageClips,
    textClips: renderTextClips,
    slots,
    captions:
      captions && captions.segments.length > 0
        ? {
            segments: captions.segments,
            styleId: captions.styleId,
            baseSettings: captions.baseSettings,
            styleConfigs: captions.styleConfigs,
          }
        : undefined,
  };
}
