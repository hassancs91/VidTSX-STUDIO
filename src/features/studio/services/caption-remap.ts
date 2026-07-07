// Caption timestamps come out of analysis in source-time (relative to the
// audio file that was transcribed). The timeline and Player both run in
// cut-time (compressed, hidden clips removed, visible clips re-anchored to
// contiguous time starting at 0). Without remapping, captions appear at the
// wrong positions whenever the source clip is offset on the timeline, has an
// in-point trim, has been split, or has hidden segments around it.
//
// This helper does the projection. Storage stays in source-time — only the
// display layer (Timeline track + Player input) consumes the remapped list.
// The output also carries enough back-references (sourceId + clip context)
// for drag/trim/cut handlers to translate user actions in cut-time back into
// source-time mutations on the underlying segment.

import type {
  TranscriptSegment,
  StudioVideoClip,
  StudioAnalysisJson,
  CaptionWord,
} from '@shared/ipc/types';

export interface RemappedCaption {
  // Unique per remap output. A source segment that crosses a cut emits
  // multiple RemappedCaption parts; each gets its own id so React keys stay
  // stable and selection / drag targets a specific part.
  id: string;
  // Back-reference to the source-time segment. Multiple parts can share this.
  sourceId: number;
  // 0 for the first (and usually only) part; higher when split across clips.
  partIndex: number;
  // Cut-time bounds for display.
  start: number;
  end: number;
  text: string;
  // Per-word timestamps, clipped to this part's range and remapped to
  // cut-time. Optional — only present when the source segment carried words.
  // Templates that animate at word granularity (Karaoke, Highlight Box, ...)
  // consume this; segment-level templates ignore it.
  words?: CaptionWord[];
  // Per-segment overrides forwarded verbatim from the source segment so
  // templates can merge them at render time via `resolveSegmentSettings`.
  // All parts derived from the same source share these — overrides are scoped
  // to the segment, not the part.
  baseOverrides?: TranscriptSegment['baseOverrides'];
  styleOverrides?: TranscriptSegment['styleOverrides'];
  // Cut-time bounds of the visible clip this part lives in. Used to clamp
  // drag/trim within the surrounding clip.
  clipCutStart: number;
  clipCutEnd: number;
  // Source-time offset of that clip — `cutTime - clipCutStart + clipInPoint`
  // gives source-time within the clip.
  clipInPoint: number;
}

export interface RemapInput {
  segments: TranscriptSegment[];
  visibleClipsInCutTime: StudioVideoClip[];
  analysis: StudioAnalysisJson | null;
}

export function remapCaptionsToCutTime({
  segments,
  visibleClipsInCutTime,
  analysis,
}: RemapInput): RemappedCaption[] {
  if (segments.length === 0) return [];

  // Without analysis we can't tell which source file the captions are tied
  // to. Fall back to treating segments as already cut-time so legacy captions
  // (whisper-era, or analysis-discarded projects) still render. Drag handlers
  // still work in this mode — they just shift source-time directly.
  if (!analysis) {
    return segments.map((seg) => ({
      id: `cap-${seg.id}-0`,
      sourceId: seg.id,
      partIndex: 0,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      words: seg.words,
      baseOverrides: seg.baseOverrides,
      styleOverrides: seg.styleOverrides,
      clipCutStart: 0,
      clipCutEnd: Number.POSITIVE_INFINITY,
      clipInPoint: 0,
    }));
  }

  const sourcePath = analysis.source.filePath;
  const sourceClips = visibleClipsInCutTime.filter((c) => c.filePath === sourcePath);
  if (sourceClips.length === 0) return [];

  const out: RemappedCaption[] = [];

  for (const seg of segments) {
    let partIndex = 0;
    for (const clip of sourceClips) {
      const inPoint = clip.inPointSeconds ?? 0;
      const clipDuration = clip.endTime - clip.startTime;
      const sourceClipEnd = inPoint + clipDuration;

      const overlapStart = Math.max(seg.start, inPoint);
      const overlapEnd = Math.min(seg.end, sourceClipEnd);
      if (overlapEnd <= overlapStart) continue;

      const cutStart = clip.startTime + (overlapStart - inPoint);
      const cutEnd = clip.startTime + (overlapEnd - inPoint);

      // Clip words to the overlap range (source-time) and remap to cut-time.
      // Words wholly outside the range are dropped; straddling words are
      // clamped to the overlap bounds.
      const partWords = seg.words
        ?.filter((w) => w.end > overlapStart && w.start < overlapEnd)
        .map<CaptionWord>((w) => {
          const ws = Math.max(w.start, overlapStart);
          const we = Math.min(w.end, overlapEnd);
          return {
            text: w.text,
            start: clip.startTime + (ws - inPoint),
            end: clip.startTime + (we - inPoint),
          };
        });

      out.push({
        id: `cap-${seg.id}-${partIndex}`,
        sourceId: seg.id,
        partIndex,
        start: cutStart,
        end: cutEnd,
        text: seg.text,
        words: partWords && partWords.length > 0 ? partWords : undefined,
        baseOverrides: seg.baseOverrides,
        styleOverrides: seg.styleOverrides,
        clipCutStart: clip.startTime,
        clipCutEnd: clip.endTime,
        clipInPoint: inPoint,
      });
      partIndex += 1;
    }
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

// Parse a remapped caption's timeline id ("cap-<sourceId>-<partIndex>") back
// to the underlying source segment id. Returns null for unrecognised ids.
export function parseCaptionClipId(clipId: string): number | null {
  const match = /^cap-(\d+)-\d+$/.exec(clipId);
  return match ? Number(match[1]) : null;
}

// Convert a cut-time instant back to source-time using the visible-clip layout.
// Returns null when the cut-time falls outside any visible clip whose source
// matches the analysis — i.e., it's not in a "captionable" region. Used by the
// cut tool (which receives a cut-time playhead) and any handler that needs
// source-time from a cut-time position.
export function cutTimeToSourceTime(
  cutTime: number,
  visibleClipsInCutTime: StudioVideoClip[],
  analysis: StudioAnalysisJson | null
): number | null {
  if (!analysis) {
    // No analysis → segments are stored in cut-time already (legacy mode).
    return cutTime;
  }
  const sourcePath = analysis.source.filePath;
  for (const clip of visibleClipsInCutTime) {
    if (clip.filePath !== sourcePath) continue;
    if (cutTime < clip.startTime || cutTime > clip.endTime) continue;
    const inPoint = clip.inPointSeconds ?? 0;
    return inPoint + (cutTime - clip.startTime);
  }
  return null;
}
