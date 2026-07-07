import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TranscriptSegment,
  StudioProjectCaptions,
  StudioAnalysisJson,
  StudioAnalysisWord,
} from '@shared/ipc/types';
import type { CaptionStyleId, CaptionBaseSettings } from '@shared/captions/types';
import { DEFAULT_BASE_SETTINGS } from '@shared/captions/types';
import { getStyleDefinition, resolveStyleSettings } from '@shared/captions/templates';
import { toSRT, toVTT, segmentsToJSON } from '@shared/captions/export-transcript';

export type ExportFormat = 'srt' | 'vtt' | 'json';

type CaptionStatus = 'idle' | 'generating' | 'done' | 'error';

interface StudioCaptionsState {
  status: CaptionStatus;
  segments: TranscriptSegment[];
  styleId: CaptionStyleId | null;
  // Position + fontSize — shared across all styles.
  baseSettings: CaptionBaseSettings;
  // Per-style configs (colors, accents, behavior toggles, etc.). Keyed by
  // styleId — switching styles preserves the previous style's customisation.
  // Each style's definition declares its shape and provides defaults; missing
  // entries fall back to those defaults via `resolveStyleSettings`.
  styleConfigs: Record<string, unknown>;
  // When true, segment times are TIMELINE (cut) times — free-floating overlays,
  // not remapped from source. Flipped on by `bakeToCutTime` after the initial
  // cut positions are committed. Reset to false on fresh generation so the new
  // (source-time) segments get baked again.
  freeform: boolean;
  error: string | null;
}

const INITIAL_STATE: StudioCaptionsState = {
  status: 'idle',
  segments: [],
  styleId: null,
  baseSettings: { ...DEFAULT_BASE_SETTINGS },
  styleConfigs: {},
  freeform: false,
  error: null,
};

// Analysis utterances are speaker turns — typically dozens of words. Captions
// need punchy on-screen chunks, so we walk word-level timestamps and break on
// (a) max words, (b) max duration, (c) a long silence gap, (d) sentence-ending
// punctuation, or (e) an utterance/speaker boundary. The fallback for words
// with no recorded duration is the utterance text split evenly across its span.
const MAX_WORDS_PER_SEGMENT = 7;
const MAX_SEGMENT_DURATION = 3.0;
const SILENCE_BREAK_GAP = 0.5;

// Exported so the TSX flow can derive a transcript straight from the analysis
// (when no captions have been generated). Captions are just this chunking with
// optional user edits, so TSX prefers captions when present and falls back here.
export function segmentsFromAnalysis(analysis: StudioAnalysisJson): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let chunk: StudioAnalysisWord[] = [];
  let nextId = 0;

  const flushChunk = () => {
    if (chunk.length === 0) return;
    const text = chunk
      .map((w) => w.text)
      .join(' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();
    if (text.length === 0) {
      chunk = [];
      return;
    }
    // Preserve per-word timestamps for templates that want word-level animation
    // (Karaoke, Highlight Box, Word Pop, ...). Templates that ignore words just
    // use the segment-level start/end as before.
    segments.push({
      id: nextId++,
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text,
      words: chunk.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    });
    chunk = [];
  };

  for (const u of analysis.utterances) {
    // Fallback for utterances missing word timestamps: keep the utterance as one
    // segment rather than dropping it entirely. No words field — templates will
    // fall back to character-distribution.
    if (!u.words || u.words.length === 0) {
      if (u.text && u.text.trim().length > 0) {
        segments.push({
          id: nextId++,
          start: u.start,
          end: u.end,
          text: u.text.trim(),
        });
      }
      continue;
    }

    for (const w of u.words) {
      // Silence-gap break: starts a new chunk if the pause before this word is long.
      if (chunk.length > 0 && w.start - chunk[chunk.length - 1].end >= SILENCE_BREAK_GAP) {
        flushChunk();
      }

      chunk.push(w);
      const durSoFar = w.end - chunk[0].start;
      const endsSentence = /[.!?]$/.test(w.text);

      if (
        chunk.length >= MAX_WORDS_PER_SEGMENT ||
        durSoFar >= MAX_SEGMENT_DURATION ||
        endsSentence
      ) {
        flushChunk();
      }
    }
    // Force a break at speaker/utterance boundary.
    flushChunk();
  }

  return segments;
}

export interface UseStudioCaptionsOptions {
  // Triggers a fresh analysis run. Captions calls this when the user clicks
  // Generate/Regenerate but no analysis exists yet; once analysis lands the
  // hook auto-derives segments. May be null if the project can't be analyzed
  // (e.g. no clips on the timeline).
  onRunAnalyze?: (() => void) | null;
  // True while an analyze run is in flight, so the button can show a spinner.
  isAnalyzing?: boolean;
}

export function useStudioCaptions(
  projectId: string | null,
  analysis: StudioAnalysisJson | null,
  savedCaptions: StudioProjectCaptions | undefined,
  onCaptionsChange: (captions: StudioProjectCaptions | undefined) => void,
  options: UseStudioCaptionsOptions = {}
) {
  const { onRunAnalyze, isAnalyzing = false } = options;
  const [state, setState] = useState<StudioCaptionsState>(INITIAL_STATE);
  // Mirror of state.freeform so persistCaptions can stamp it without threading
  // the flag through every mutation call site.
  const freeformRef = useRef(false);
  freeformRef.current = state.freeform;
  const lastProjectIdRef = useRef<string | null>(null);
  // Set true when Generate/Regenerate is clicked but analysis is missing — the
  // analyze useEffect below picks this up and auto-derives once analysis lands.
  const pendingGenerateRef = useRef(false);

  // Restore from saved project data when project changes
  useEffect(() => {
    if (projectId === lastProjectIdRef.current) return;
    lastProjectIdRef.current = projectId;
    pendingGenerateRef.current = false;

    if (savedCaptions && savedCaptions.segments.length > 0) {
      setState({
        status: 'done',
        segments: savedCaptions.segments,
        styleId: savedCaptions.styleId as CaptionStyleId,
        baseSettings: savedCaptions.settings ?? { ...DEFAULT_BASE_SETTINGS },
        styleConfigs: savedCaptions.styleConfigs ?? {},
        freeform: savedCaptions.freeform ?? false,
        error: null,
      });
    } else {
      setState(INITIAL_STATE);
    }
  }, [projectId, savedCaptions]);

  // Persist captions when they change. Storage shape: segments + styleId +
  // baseSettings (under the legacy `settings` field name) + styleConfigs.
  const persistCaptions = useCallback(
    (
      segments: TranscriptSegment[],
      styleId: CaptionStyleId | null,
      baseSettings: CaptionBaseSettings,
      styleConfigs: Record<string, unknown>,
    ) => {
      if (segments.length === 0) {
        onCaptionsChange(undefined);
        return;
      }
      onCaptionsChange({
        segments,
        styleId: styleId ?? 'bold-pop',
        settings: baseSettings,
        styleConfigs: Object.keys(styleConfigs).length > 0 ? styleConfigs : undefined,
        freeform: freeformRef.current ? true : undefined,
      });
    },
    [onCaptionsChange]
  );

  // Chunk + commit segments from a known-good analysis. Shared by the
  // user-initiated generate path and the pending-after-analyze path.
  const deriveAndCommit = useCallback(
    (a: StudioAnalysisJson) => {
      const segments = segmentsFromAnalysis(a);
      if (segments.length === 0) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Analysis contains no utterances. Try re-running analysis on a clip with speech.',
        }));
        return;
      }
      // Fresh segments come out in source-time → they must be (re)baked to
      // cut-time, so clear the freeform flag before persisting.
      freeformRef.current = false;
      setState((prev) => {
        const styleId: CaptionStyleId = prev.styleId ?? 'bold-pop';
        const baseSettings = prev.styleId ? prev.baseSettings : { ...DEFAULT_BASE_SETTINGS };
        const styleConfigs = prev.styleConfigs;
        persistCaptions(segments, styleId, baseSettings, styleConfigs);
        return {
          status: 'done',
          segments,
          styleId,
          baseSettings,
          styleConfigs,
          freeform: false,
          error: null,
        };
      });
    },
    [persistCaptions]
  );

  const generate = useCallback(() => {
    if (!analysis) {
      // No analysis yet — kick off an analyze run if we can, and remember to
      // finish the user's request once it lands.
      if (onRunAnalyze) {
        pendingGenerateRef.current = true;
        setState((prev) => ({ ...prev, status: 'generating', error: null }));
        onRunAnalyze();
      } else {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Add a clip to the timeline first, then click Generate.',
        }));
      }
      return;
    }
    deriveAndCommit(analysis);
  }, [analysis, onRunAnalyze, deriveAndCommit]);

  // Auto-finish the pending generate request once analysis becomes available.
  useEffect(() => {
    if (!analysis) return;
    if (!pendingGenerateRef.current) return;
    pendingGenerateRef.current = false;
    deriveAndCommit(analysis);
  }, [analysis, deriveAndCommit]);

  // If the analyze run failed or was cancelled, surface that here instead of
  // leaving the captions button stuck in a "generating" state.
  useEffect(() => {
    if (isAnalyzing) return;
    if (!pendingGenerateRef.current) return;
    if (analysis) return; // covered by the analyze→derive path above
    pendingGenerateRef.current = false;
    setState((prev) =>
      prev.status === 'generating'
        ? { ...prev, status: 'error', error: 'Analyze was cancelled or failed. Try again.' }
        : prev
    );
  }, [isAnalyzing, analysis]);

  const setStyleId = useCallback(
    (styleId: CaptionStyleId) => {
      setState((prev) => {
        // Switching styles preserves the previous style's config under its key,
        // so coming back later restores everything the user customised.
        persistCaptions(prev.segments, styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, styleId };
      });
    },
    [persistCaptions]
  );

  const updateBaseSettings = useCallback(
    (updates: Partial<CaptionBaseSettings>) => {
      setState((prev) => {
        const next = { ...prev.baseSettings, ...updates };
        persistCaptions(prev.segments, prev.styleId, next, prev.styleConfigs);
        return { ...prev, baseSettings: next };
      });
    },
    [persistCaptions]
  );

  // Update the active (or any) style's customisation blob. The hook treats the
  // value as opaque — only the style's ConfigPanel + Component know its shape.
  const updateStyleSettings = useCallback(
    (styleId: CaptionStyleId, next: unknown) => {
      setState((prev) => {
        const styleConfigs = { ...prev.styleConfigs, [styleId]: next };
        persistCaptions(prev.segments, prev.styleId, prev.baseSettings, styleConfigs);
        return { ...prev, styleConfigs };
      });
    },
    [persistCaptions]
  );

  const updateSegmentText = useCallback(
    (segmentId: number, text: string) => {
      setState((prev) => {
        const segments = prev.segments.map((seg) =>
          seg.id === segmentId ? { ...seg, text } : seg
        );
        persistCaptions(segments, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments };
      });
    },
    [persistCaptions]
  );

  // Partition a segment's words array around a split time. Words wholly
  // before the time go left, wholly after go right, straddling words go to
  // whichever side they overlap more.
  const splitWordsAtTime = (
    words: TranscriptSegment['words'] | undefined,
    splitTime: number,
  ): { left: TranscriptSegment['words']; right: TranscriptSegment['words'] } => {
    if (!words || words.length === 0) return { left: undefined, right: undefined };
    const left: NonNullable<TranscriptSegment['words']> = [];
    const right: NonNullable<TranscriptSegment['words']> = [];
    for (const w of words) {
      if (w.end <= splitTime) left.push(w);
      else if (w.start >= splitTime) right.push(w);
      else {
        const leftOverlap = splitTime - w.start;
        const rightOverlap = w.end - splitTime;
        if (leftOverlap >= rightOverlap) left.push(w);
        else right.push(w);
      }
    }
    return {
      left: left.length > 0 ? left : undefined,
      right: right.length > 0 ? right : undefined,
    };
  };

  const splitSegment = useCallback(
    (segmentId: number, cursorPosition: number) => {
      setState((prev) => {
        const segIndex = prev.segments.findIndex((s) => s.id === segmentId);
        if (segIndex === -1) return prev;

        const seg = prev.segments[segIndex];
        if (cursorPosition <= 0 || cursorPosition >= seg.text.length) return prev;

        const textBefore = seg.text.slice(0, cursorPosition).trim();
        const textAfter = seg.text.slice(cursorPosition).trim();
        if (!textBefore || !textAfter) return prev;

        const ratio = cursorPosition / seg.text.length;
        const splitTime = seg.start + ratio * (seg.end - seg.start);

        const maxId = prev.segments.reduce((max, s) => Math.max(max, s.id), 0);
        const { left, right } = splitWordsAtTime(seg.words, splitTime);

        const newSegments = [...prev.segments];
        newSegments.splice(segIndex, 1,
          { id: seg.id, start: seg.start, end: splitTime, text: textBefore, words: left },
          { id: maxId + 1, start: splitTime, end: seg.end, text: textAfter, words: right }
        );

        persistCaptions(newSegments, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: newSegments };
      });
    },
    [persistCaptions]
  );

  const splitAtTime = useCallback(
    (timeInSeconds: number) => {
      setState((prev) => {
        const segIndex = prev.segments.findIndex(
          (s) => timeInSeconds >= s.start && timeInSeconds < s.end
        );
        if (segIndex === -1) return prev;

        const seg = prev.segments[segIndex];
        const ratio = (timeInSeconds - seg.start) / (seg.end - seg.start);
        if (ratio <= 0.05 || ratio >= 0.95) return prev; // too close to edges

        const splitChar = Math.round(ratio * seg.text.length);
        const textBefore = seg.text.slice(0, splitChar).trim();
        const textAfter = seg.text.slice(splitChar).trim();
        if (!textBefore || !textAfter) return prev;

        const maxId = prev.segments.reduce((max, s) => Math.max(max, s.id), 0);
        const { left, right } = splitWordsAtTime(seg.words, timeInSeconds);

        const newSegments = [...prev.segments];
        newSegments.splice(segIndex, 1,
          { id: seg.id, start: seg.start, end: timeInSeconds, text: textBefore, words: left },
          { id: maxId + 1, start: timeInSeconds, end: seg.end, text: textAfter, words: right }
        );

        persistCaptions(newSegments, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: newSegments };
      });
    },
    [persistCaptions]
  );

  // ─── Source-time mutation ops invoked by Timeline drag / cut / delete ───
  // Source-time is the canonical storage; the timeline display uses cut-time
  // via the remap, and StudioScreen converts cut-time deltas to source-time
  // deltas before calling these.

  const MIN_SEGMENT_DURATION = 0.05;

  const moveSegment = useCallback(
    (segmentId: number, newStartSourceTime: number) => {
      setState((prev) => {
        const seg = prev.segments.find((s) => s.id === segmentId);
        if (!seg) return prev;
        const duration = seg.end - seg.start;
        const clamped = Math.max(0, newStartSourceTime);
        const delta = clamped - seg.start;
        if (Math.abs(delta) < 1e-4) return prev;
        const next = prev.segments.map((s) =>
          s.id === segmentId
            ? {
                ...s,
                start: clamped,
                end: clamped + duration,
                words: s.words?.map((w) => ({ ...w, start: w.start + delta, end: w.end + delta })),
              }
            : s
        );
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const trimSegment = useCallback(
    (segmentId: number, edge: 'start' | 'end', newTimeSource: number) => {
      setState((prev) => {
        const seg = prev.segments.find((s) => s.id === segmentId);
        if (!seg) return prev;
        let start = seg.start;
        let end = seg.end;
        if (edge === 'start') {
          start = Math.max(0, Math.min(end - MIN_SEGMENT_DURATION, newTimeSource));
        } else {
          end = Math.max(start + MIN_SEGMENT_DURATION, newTimeSource);
        }
        if (Math.abs(start - seg.start) < 1e-4 && Math.abs(end - seg.end) < 1e-4) return prev;
        // Drop words whose midpoint now falls outside the trimmed range so the
        // word list stays consistent with seg.start/seg.end.
        const trimmedWords = seg.words
          ? seg.words.filter((w) => {
              const mid = (w.start + w.end) / 2;
              return mid >= start && mid <= end;
            })
          : undefined;
        const next = prev.segments.map((s) =>
          s.id === segmentId
            ? {
                ...s,
                start,
                end,
                words: trimmedWords && trimmedWords.length > 0 ? trimmedWords : undefined,
              }
            : s
        );
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const removeSegment = useCallback(
    (segmentId: number) => {
      setState((prev) => {
        const next = prev.segments.filter((s) => s.id !== segmentId);
        if (next.length === prev.segments.length) return prev;
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  // ─── Per-segment overrides ─────────────────────────────────────────────
  // Each segment can carry partial overrides over the project-level base /
  // style settings. Storage and render layer merge them in. These ops
  // surgically update one segment's overrides without touching anything else.

  const setBaseOverride = useCallback(
    <K extends keyof CaptionBaseSettings>(
      segmentId: number,
      key: K,
      value: CaptionBaseSettings[K],
    ) => {
      setState((prev) => {
        const next = prev.segments.map((s) => {
          if (s.id !== segmentId) return s;
          return {
            ...s,
            baseOverrides: { ...(s.baseOverrides ?? {}), [key]: value },
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const clearBaseOverride = useCallback(
    (segmentId: number, key: keyof CaptionBaseSettings) => {
      setState((prev) => {
        const next = prev.segments.map((s) => {
          if (s.id !== segmentId || !s.baseOverrides) return s;
          const { [key]: _removed, ...rest } = s.baseOverrides;
          return {
            ...s,
            baseOverrides: Object.keys(rest).length > 0 ? rest : undefined,
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const setStyleOverride = useCallback(
    (segmentId: number, styleId: CaptionStyleId, key: string, value: unknown) => {
      setState((prev) => {
        const next = prev.segments.map((s) => {
          if (s.id !== segmentId) return s;
          const existing = s.styleOverrides ?? {};
          const forStyle = existing[styleId] ?? {};
          return {
            ...s,
            styleOverrides: {
              ...existing,
              [styleId]: { ...forStyle, [key]: value },
            },
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const clearStyleOverride = useCallback(
    (segmentId: number, styleId: CaptionStyleId, key: string) => {
      setState((prev) => {
        const next = prev.segments.map((s) => {
          if (s.id !== segmentId || !s.styleOverrides) return s;
          const forStyle = s.styleOverrides[styleId];
          if (!forStyle) return s;
          const { [key]: _removed, ...rest } = forStyle;
          const nextOverrides = { ...s.styleOverrides };
          if (Object.keys(rest).length > 0) {
            nextOverrides[styleId] = rest;
          } else {
            delete nextOverrides[styleId];
          }
          return {
            ...s,
            styleOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  // Apply the active style's full settings object to one segment as an
  // override. The hook diffs the incoming `full` against the project-level
  // settings — only keys that actually differ get stored. This avoids the
  // "snapshot trap" where a segment unintentionally pins values the user
  // didn't mean to override, then later refuses to follow a global change.
  const setSegmentStyleSnapshot = useCallback(
    (segmentId: number, styleId: CaptionStyleId, full: Record<string, unknown>) => {
      setState((prev) => {
        const def = getStyleDefinition(styleId);
        if (!def) return prev;
        const stored = (prev.styleConfigs[styleId] ?? {}) as Record<string, unknown>;
        const global = {
          ...(def.defaults as Record<string, unknown>),
          ...stored,
        };
        const override: Record<string, unknown> = {};
        for (const key of Object.keys(full)) {
          if (JSON.stringify(full[key]) !== JSON.stringify(global[key])) {
            override[key] = full[key];
          }
        }
        const next = prev.segments.map((s) => {
          if (s.id !== segmentId) return s;
          const allOverrides = { ...(s.styleOverrides ?? {}) };
          if (Object.keys(override).length > 0) {
            allOverrides[styleId] = override;
          } else {
            delete allOverrides[styleId];
          }
          return {
            ...s,
            styleOverrides:
              Object.keys(allOverrides).length > 0 ? allOverrides : undefined,
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  // Reset every override (base + every style's bucket) on one segment back to
  // global. Used by the "Reset all" affordance in the segment-override banner.
  const clearAllSegmentOverrides = useCallback(
    (segmentId: number) => {
      setState((prev) => {
        const next = prev.segments.map((s) =>
          s.id === segmentId ? { ...s, baseOverrides: undefined, styleOverrides: undefined } : s
        );
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next };
      });
    },
    [persistCaptions]
  );

  const exportCaptions = useCallback(
    async (format: ExportFormat) => {
      if (state.segments.length === 0) return;

      const ext = format === 'srt' ? 'srt' : format === 'vtt' ? 'vtt' : 'json';
      const filterName = format === 'srt' ? 'SRT Subtitles' : format === 'vtt' ? 'WebVTT Subtitles' : 'JSON';

      let content: string;
      if (format === 'srt') content = toSRT(state.segments);
      else if (format === 'vtt') content = toVTT(state.segments);
      else content = segmentsToJSON(state.segments);

      await window.api.dialogSave({
        filters: [{ name: filterName, extensions: [ext] }],
        content,
      });
    },
    [state.segments]
  );

  const clearCaptions = useCallback(() => {
    setState(INITIAL_STATE);
    onCaptionsChange(undefined);
  }, [onCaptionsChange]);

  // History restore — replace internal state from a snapshot of saved captions
  // (or clear when undefined), then mirror it back to the project store. Mirrors
  // the project-switch restore effect but runs on demand within the same project.
  const restore = useCallback(
    (saved: StudioProjectCaptions | undefined) => {
      freeformRef.current = saved?.freeform ?? false;
      if (saved && saved.segments.length > 0) {
        setState({
          status: 'done',
          segments: saved.segments,
          styleId: saved.styleId as CaptionStyleId,
          baseSettings: saved.settings ?? { ...DEFAULT_BASE_SETTINGS },
          styleConfigs: saved.styleConfigs ?? {},
          freeform: saved.freeform ?? false,
          error: null,
        });
      } else {
        setState(INITIAL_STATE);
      }
      onCaptionsChange(saved);
    },
    [onCaptionsChange]
  );

  // Bake the captions' current cut-time positions into storage and flip them to
  // free-floating. `targets` carries each segment's computed cut-time start/end
  // (from the remap). Words shift by the same delta as their segment. After this
  // the captions no longer track the video — they're positioned in timeline time.
  const bakeToCutTime = useCallback(
    (targets: { id: number; start: number; end: number }[]) => {
      const byId = new Map(targets.map((t) => [t.id, t]));
      freeformRef.current = true;
      setState((prev) => {
        const next = prev.segments.map((seg) => {
          const t = byId.get(seg.id);
          if (!t) return seg;
          const delta = t.start - seg.start;
          return {
            ...seg,
            start: t.start,
            end: t.end,
            words: seg.words?.map((w) => ({
              ...w,
              start: w.start + delta,
              end: w.end + delta,
            })),
          };
        });
        persistCaptions(next, prev.styleId, prev.baseSettings, prev.styleConfigs);
        return { ...prev, segments: next, freeform: true };
      });
    },
    [persistCaptions]
  );

  // Resolved settings for the active style — merge of declared defaults + the
  // stored per-style blob. Always fully populated so consumers (Player input,
  // ConfigPanel, ...) never have to handle missing keys.
  const activeStyleSettings = state.styleId
    ? resolveStyleSettings(state.styleId, state.styleConfigs)
    : null;
  const activeStyleDefinition = state.styleId ? getStyleDefinition(state.styleId) : undefined;

  return {
    status: state.status,
    segments: state.segments,
    styleId: state.styleId,
    baseSettings: state.baseSettings,
    styleConfigs: state.styleConfigs,
    freeform: state.freeform,
    activeStyleSettings,
    activeStyleDefinition,
    error: state.error,
    hasAnalysis: !!analysis,
    generate,
    setStyleId,
    updateBaseSettings,
    updateStyleSettings,
    updateSegmentText,
    splitSegment,
    splitAtTime,
    moveSegment,
    trimSegment,
    removeSegment,
    setBaseOverride,
    clearBaseOverride,
    setStyleOverride,
    clearStyleOverride,
    setSegmentStyleSnapshot,
    clearAllSegmentOverrides,
    exportCaptions,
    clearCaptions,
    restore,
    bakeToCutTime,
  };
}
