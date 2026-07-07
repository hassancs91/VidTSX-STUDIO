import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TranscriptSegment,
  StudioComposition,
  TsxSuggestion,
} from '@shared/ipc/types';

export type TsxAnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface TsxAnalysisState {
  status: TsxAnalysisStatus;
  suggestions: TsxSuggestion[];
  error: string | null;
}

interface ProjectAiInputs {
  // Resolved brand markdown for the active project (from brandId lookup).
  // Falls back to undefined when no brand is bound.
  brand?: string;
  // Resolved preset entries (name + content) for the active project.
  // Order is preserved; the handler concatenates them as composable rules.
  presets?: { name: string; content: string }[];
  // Cut-time overrides. The Studio timeline + Remotion overlays operate in
  // cut-time (visible-clip duration), so suggestions must come back in that
  // space too — otherwise they misalign whenever the user has trimmed video,
  // hidden clips, or applied a cut plan. When provided, these supersede the
  // positional `segments` arg and the composition's durationInSeconds.
  cutTimeSegments?: TranscriptSegment[];
  cutTimeDurationSeconds?: number;
}

export function useTsxAnalysis(
  segments: TranscriptSegment[],
  composition: StudioComposition | null,
  savedSuggestions: TsxSuggestion[] | undefined,
  onUpdate: (suggestions: TsxSuggestion[] | undefined) => void,
  aiInputs?: ProjectAiInputs
) {
  const [state, setState] = useState<TsxAnalysisState>(() => {
    if (savedSuggestions && savedSuggestions.length > 0) {
      return { status: 'done', suggestions: savedSuggestions, error: null };
    }
    return { status: 'idle', suggestions: [], error: null };
  });
  const [userPrompt, setUserPrompt] = useState('');
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  // aiInputs (brand + presets) is read through a ref so changing the active
  // brand or toggling presets doesn't force callers to memoize the object —
  // the next analyze() call picks up the latest resolved values.
  const aiInputsRef = useRef(aiInputs);
  aiInputsRef.current = aiInputs;

  // Sync if savedSuggestions changes externally (e.g., project switch)
  const prevSavedRef = useRef(savedSuggestions);
  useEffect(() => {
    if (prevSavedRef.current !== savedSuggestions) {
      prevSavedRef.current = savedSuggestions;
      if (savedSuggestions && savedSuggestions.length > 0) {
        setState({ status: 'done', suggestions: savedSuggestions, error: null });
      } else if (state.status !== 'analyzing') {
        setState({ status: 'idle', suggestions: [], error: null });
      }
    }
  }, [savedSuggestions, state.status]);

  const analyze = useCallback(async () => {
    if (!composition || segments.length === 0) return;

    setState({ status: 'analyzing', suggestions: [], error: null });

    try {
      const ai = aiInputsRef.current;
      // Prefer cut-time overrides when present so suggestions land in the same
      // coordinate space as the timeline and Remotion overlays.
      const segmentsToSend = ai?.cutTimeSegments ?? segments;
      const durationToSend = ai?.cutTimeDurationSeconds ?? composition.durationInSeconds;
      const result = await window.api.studioTsxAnalyze({
        segments: segmentsToSend,
        videoDurationSeconds: durationToSend,
        videoWidth: composition.width,
        videoHeight: composition.height,
        fps: composition.fps,
        userPrompt: userPrompt.trim() || undefined,
        brand: ai?.brand?.trim() ? ai.brand : undefined,
        presets: ai?.presets && ai.presets.length > 0 ? ai.presets : undefined,
      });

      if (!result.success) {
        setState({
          status: 'error',
          suggestions: [],
          error: result.error ?? 'Analysis failed',
        });
        return;
      }

      const suggestions = result.suggestions ?? [];
      setState({
        status: 'done',
        suggestions,
        error:
          suggestions.length === 0
            ? 'No suggestions generated. Try adding a description of your video.'
            : null,
      });

      // Persist to project data
      onUpdateRef.current(suggestions.length > 0 ? suggestions : undefined);
    } catch (err) {
      setState({
        status: 'error',
        suggestions: [],
        error: err instanceof Error ? err.message : 'Analysis failed',
      });
    }
  }, [segments, composition, userPrompt]);

  const clearSuggestions = useCallback(() => {
    setState({ status: 'idle', suggestions: [], error: null });
    onUpdateRef.current(undefined);
  }, []);

  return {
    status: state.status,
    suggestions: state.suggestions,
    error: state.error,
    userPrompt,
    setUserPrompt,
    analyze,
    clearSuggestions,
  };
}
