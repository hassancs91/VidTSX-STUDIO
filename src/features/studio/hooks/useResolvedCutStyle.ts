// The project's resolved cut style (plan T1, B2) for the renderer. Main owns
// the resolution (it reads cut-style.json and the preset file); this hook asks
// for it with the LIVE document's settings, so an unsaved override counts, and
// asks again when those settings change or the Studio screen comes back (the
// preset may have been edited on the Assets screen meanwhile).

import { useEffect, useRef, useState } from 'react';
import type { ResolvedCutStyle } from '@shared/types/studio-cut-plan';
import type { StudioCutStyleSettings } from '@shared/ipc/types';

export interface ResolvedCutStyleState {
  /** Null until the first answer arrives (and after a failed one). */
  resolved: ResolvedCutStyle | null;
  /** Why the last resolve failed — null while loading or after a success. */
  error: string | null;
}

const LOADING: ResolvedCutStyleState = { resolved: null, error: null };

/** An answer remembers its project, so another project's style never shows. */
interface Answer extends ResolvedCutStyleState {
  projectId: string;
}

export function useResolvedCutStyle(
  projectId: string | null,
  settings: StudioCutStyleSettings | null,
): ResolvedCutStyleState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Only the newest request may land — an older answer can arrive late.
  const seq = useRef(0);
  const [screenTick, setScreenTick] = useState(0);

  const presetId = settings?.presetId;
  // The override is a small plain object; its text is a stable dependency.
  const cutStyleKey = settings?.cutStyle === undefined ? '' : JSON.stringify(settings.cutStyle);

  useEffect(() => {
    const onScreen = (e: Event) => {
      if ((e as CustomEvent<{ screen?: string }>).detail?.screen === 'studio') setScreenTick((n) => n + 1);
    };
    window.addEventListener('vidtsx:screen-active', onScreen);
    return () => window.removeEventListener('vidtsx:screen-active', onScreen);
  }, []);

  useEffect(() => {
    const id = ++seq.current;
    if (!projectId) return;
    const live: StudioCutStyleSettings = {
      ...(presetId ? { presetId } : {}),
      ...(cutStyleKey ? { cutStyle: JSON.parse(cutStyleKey) as StudioCutStyleSettings['cutStyle'] } : {}),
    };
    void (async () => {
      try {
        const res = await window.api.studioCutStyleResolve({ projectId, settings: live });
        if (id !== seq.current) return;
        setAnswer(
          res.success && res.resolved
            ? { projectId, resolved: res.resolved, error: null }
            : { projectId, resolved: null, error: res.error ?? 'The cut style could not be resolved' },
        );
      } catch (err) {
        if (id !== seq.current) return;
        setAnswer({ projectId, resolved: null, error: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [projectId, presetId, cutStyleKey, screenTick]);

  if (!projectId || !answer || answer.projectId !== projectId) return LOADING;
  return answer;
}
