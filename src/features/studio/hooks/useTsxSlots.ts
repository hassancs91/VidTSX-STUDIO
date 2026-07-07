import { useState, useCallback, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type {
  TsxSuggestion,
  TsxSlot,
  StudioComposition,
  LlmImageIpc,
  LayerTransform,
} from '@shared/ipc/types';
import { generateTsxPipeline } from '@shared/tsx-engine';
import type { PipelineProgress } from '@shared/tsx-engine';
import {
  registerSlotComponent,
  unregisterSlotComponent,
  getSlotComponent,
  clearSlotRegistry,
} from '../services/tsx-slot-registry';
import { splitClipsAtTime } from '../services/cut-service';

// `pending` — slot placed on the timeline from an analysis suggestion, no
// file on disk yet. Click → SlotEditor → Generate to graduate.
// `queued` — user has hit Generate but another generation is in flight; this
// slot is sitting in the queue waiting for its turn.
// `generating`/`transpiling`/`ready`/`error` — the existing post-generate states.
export type SlotRuntimeStatus =
  | 'pending'
  | 'queued'
  | 'generating'
  | 'transpiling'
  | 'ready'
  | 'error';

export interface SlotRuntime {
  slot: TsxSlot;
  status: SlotRuntimeStatus;
  error: string | null;
  // Live pipeline progress while `status === 'generating'`. Null otherwise.
  // The SlotEditor feeds this into useSmoothProgress for the visible bar.
  progress: PipelineProgress | null;
}

interface GenerateSlotOptions {
  // Resolved brand markdown for the active project (from brandId lookup).
  // Inlined into the generation prompt so the produced TSX matches the brand.
  brand?: string;
}

interface UseTsxSlotsResult {
  slots: SlotRuntime[];
  // Legacy entry point — generate from a raw suggestion (no editor visit).
  // Kept so the old card-based UI keeps working until we fully migrate.
  generateSlot: (suggestion: TsxSuggestion, options?: GenerateSlotOptions) => Promise<void>;
  // Auto-create pending placeholder slots from a fresh analysis run. Existing
  // slots (pending or otherwise) for the same suggestion id are preserved.
  seedPendingFromSuggestions: (suggestions: TsxSuggestion[]) => void;
  // Editor mutations — apply to a pending or ready slot.
  updateSlotEditor: (
    slotId: string,
    patch: { customPrompt?: string; referenceImages?: LlmImageIpc[] }
  ) => void;
  // Generate TSX for an existing slot using its stored prompt + reference
  // images. Used by the SlotEditor and (later) batch generation.
  generateFromSlot: (slotId: string, options?: GenerateSlotOptions) => Promise<void>;
  // Drop a pending slot without generating. Removes from timeline + persistence.
  dismissPendingSlot: (slotId: string) => void;
  // Cancel-all. Aborts the active LLM call AND empties the queue. Any queued
  // slots flip back to 'pending'. The running slot lands in 'error' (the
  // catch block in runGenerationForSlot picks that up).
  cancelActiveGeneration: () => Promise<void>;
  // Per-slot cancel. If the slot is queued → just drop it from the queue
  // and flip its status back to 'pending'. If the slot is the currently
  // running one → abort the active LLM call (same as cancelActiveGeneration
  // but limited to checking that this slot is the active one).
  cancelSlotGeneration: (slotId: string) => Promise<void>;
  // Enqueue every slot still in 'pending' for generation. The queue
  // processes them one at a time (engine constraint); the UI feels parallel
  // because the user fires and walks away.
  generateAllPending: (options?: GenerateSlotOptions) => void;
  addSlotFromFile: (sourceFilePath: string, startTime: number, durationSeconds: number) => Promise<void>;
  moveSlot: (slotId: string, newStartTime: number) => void;
  trimSlot: (slotId: string, edge: 'start' | 'end', newTime: number) => void;
  // Set (or clear) the slot's canvas transform. Undefined resets to full-frame.
  setSlotTransform: (slotId: string, transform: LayerTransform | undefined) => void;
  // Replace the entire slot set from a history snapshot. Reconciles the runtime
  // + component registry against the target list (keep loaded components, re-
  // transpile reappearing slots, unregister vanished ones).
  restore: (targetSlots: TsxSlot[] | undefined) => void;
  removeSlot: (slotId: string) => void;
  splitAtTime: (timeInSeconds: number) => boolean;
  getStatusForSuggestion: (
    suggestionId: string
  ) => {
    slotId: string;
    status: SlotRuntimeStatus;
    error: string | null;
    progress: PipelineProgress | null;
  } | null;
  // Look up a runtime by slot id — the SlotEditor binds against this.
  getRuntime: (slotId: string) => SlotRuntime | null;
}

const MIN_SLOT_DURATION_SECONDS = 0.1;

interface LoadedSlot {
  component: ComponentType;
  sourceDurationSeconds: number | null;
}

async function transpileAndLoadComponent(
  projectId: string,
  fileName: string
): Promise<LoadedSlot> {
  const pathResult = await window.api.studioTsxGetPath({ projectId, fileName });
  const result = await window.api.moduleTranspile({ filePath: pathResult.filePath });

  if (!result.success || !result.moduleUrl) {
    throw new Error(result.error ?? 'Transpilation failed');
  }

  const moduleUrl = `${result.moduleUrl}?t=${Date.now()}`;
  const module = await import(/* @vite-ignore */ moduleUrl);

  const cfg = result.compositionConfig;
  const sourceDurationSeconds =
    cfg && cfg.fps > 0 ? cfg.durationInFrames / cfg.fps : null;

  return {
    component: module.default as ComponentType,
    sourceDurationSeconds,
  };
}

export function useTsxSlots(
  savedSlots: TsxSlot[] | undefined,
  onUpdate: (slots: TsxSlot[] | undefined) => void,
  projectId: string | undefined,
  composition: StudioComposition | null,
  ready: boolean = true,
  // Optional ref carrying the live "timeline working duration" — i.e. the max
  // of the video duration and any content (slots/clips) currently placed,
  // plus padding. Move/trim bounds clamp against this instead of the static
  // composition duration so the timeline can elongate as content grows
  // (pro-NLE feel). Caller updates the ref on every render; the hook reads
  // it inside drag/trim handlers where it's needed.
  timelineDurationRef?: React.MutableRefObject<number>
): UseTsxSlotsResult {
  const [slots, setSlots] = useState<SlotRuntime[]>([]);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  // Mirror the latest slots so async generation code can read fresh slot data
  // without going through `setSlots(prev => …)`-as-side-channel (which doesn't
  // see writes from a setSlots call earlier in the same tick before React has
  // flushed them — that's the bug behind "card Generate stuck at 0%").
  const slotsRef = useRef<SlotRuntime[]>([]);
  slotsRef.current = slots;
  const initRef = useRef(false);

  // ── Generation queue ──
  // The LLM engine is single-session (one provider, one in-flight call), so
  // we can't truly run generations in parallel without an engine refactor.
  // Instead we maintain a queue here: clicking Generate on N cards enqueues
  // all of them and the processor walks the queue one at a time. From the
  // user's POV this feels like "fire and walk away" parallel — they're not
  // blocked on each click.
  const queueRef = useRef<Array<{ slotId: string; options?: GenerateSlotOptions }>>([]);
  const activeSlotIdRef = useRef<string | null>(null);
  const processQueueRef = useRef<() => void>(() => {});

  // Initialize: load saved slots on mount (wait for module globals to be ready)
  useEffect(() => {
    if (!ready || !projectId || !savedSlots || savedSlots.length === 0 || initRef.current) return;
    initRef.current = true;

    // Pending slots (no file on disk) keep their `pending` status. Everything
    // else has TSX to load → goes through transpile/register.
    const runtimes: SlotRuntime[] = savedSlots.map((slot) => ({
      slot,
      status: !slot.fileName ? ('pending' as const) : ('transpiling' as const),
      error: null,
      progress: null,
    }));
    setSlots(runtimes);

    // Transpile and load each non-pending saved slot
    for (const slot of savedSlots) {
      if (!slot.fileName) continue;
      transpileAndLoadComponent(projectId, slot.fileName)
        .then(({ component, sourceDurationSeconds }) => {
          registerSlotComponent(slot.id, component);
          setSlots((prev) =>
            prev.map((s) =>
              s.slot.id === slot.id
                ? {
                    ...s,
                    status: 'ready',
                    slot: {
                      ...s.slot,
                      sourceDurationSeconds:
                        s.slot.sourceDurationSeconds ??
                        (sourceDurationSeconds ?? undefined),
                    },
                  }
                : s
            )
          );
        })
        .catch((err) => {
          const error = err instanceof Error ? err.message : 'Failed to load';
          setSlots((prev) =>
            prev.map((s) =>
              s.slot.id === slot.id ? { ...s, status: 'error', error } : s
            )
          );
        });
    }
    // No cleanup here — project-level cleanup lives in the effect keyed on projectId.
    // A cleanup here would run on every savedSlots reference change (e.g., persist on drag)
    // and wipe the registry while initRef.current blocks re-registration.
  }, [projectId, savedSlots, ready]);

  // Reset when project changes
  useEffect(() => {
    return () => {
      initRef.current = false;
      clearSlotRegistry();
      setSlots([]);
    };
  }, [projectId]);

  const persistSlots = useCallback((updatedSlots: SlotRuntime[]) => {
    // Pending + queued slots persist too — they're the user's "plan" for the
    // project. Queued slots reload as pending after a restart (the queue
    // itself doesn't survive). Generating/error slots aren't worth
    // persisting (transient or broken).
    const persistable = updatedSlots
      .filter(
        (s) =>
          s.status === 'ready' ||
          s.status === 'transpiling' ||
          s.status === 'pending' ||
          s.status === 'queued'
      )
      .map((s) => s.slot);
    onUpdateRef.current(persistable.length > 0 ? persistable : undefined);
  }, []);

  // Shared generation core. Takes the slot data directly so we don't have to
  // round-trip through setSlots-as-side-channel just to read it.
  // Drives `generateTsxPipeline` so live progress flows into the SlotEditor.
  // Updates status through the pipeline; surfaces errors as `status: 'error'`.
  const runGenerationForSlot = useCallback(
    async (slotSnapshot: TsxSlot, options?: GenerateSlotOptions) => {
      if (!projectId || !composition) return;

      const slotId = slotSnapshot.id;

      // Flip to 'generating' as a pure functional update — no side effects
      // captured inside the updater (any slot lookup happens via slotsRef).
      setSlots((prev) =>
        prev.map((s) =>
          s.slot.id === slotId
            ? { ...s, status: 'generating' as const, error: null, progress: null }
            : s
        )
      );

      const promptForLlm =
        slotSnapshot.customPrompt?.trim() ||
        slotSnapshot.originalPrompt?.trim() ||
        '';
      if (!promptForLlm) {
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.id === slotId
              ? { ...s, status: 'error' as const, error: 'No prompt set', progress: null }
              : s
          )
        );
        return;
      }

      const durationSeconds = slotSnapshot.endTime - slotSnapshot.startTime;
      // File name keyed on suggestion id so re-generations overwrite the same
      // file (and Vite picks up the new module via the cache-bust ?t=).
      // Versioning lives in Phase 3.
      const fileName = slotSnapshot.fileName || `slot_${slotSnapshot.suggestionId}.tsx`;
      // Append brand profile as a post-prompt steering block so the same idea
      // adopts the right visual style. Kept inline (not via system prompt) so
      // the generator's existing system prompt stays untouched.
      const brandedPrompt = options?.brand?.trim()
        ? `${promptForLlm}\n\n--- BRAND PROFILE (match this style) ---\n${options.brand.trim()}\n--- END BRAND PROFILE ---`
        : promptForLlm;

      const referenceImages =
        slotSnapshot.referenceImages && slotSnapshot.referenceImages.length > 0
          ? slotSnapshot.referenceImages
          : undefined;

      try {
        const genResult = await generateTsxPipeline({
          prompt: brandedPrompt,
          // Single-pass for v1 — keeps generation fast + predictable. The
          // user can re-generate manually if a result is weak; a future
          // option in the SlotEditor can flip this to multi-turn refine.
          maxTurns: 1,
          optimize: false,
          onProgress: (p: PipelineProgress) => {
            setSlots((prev) =>
              prev.map((s) => (s.slot.id === slotId ? { ...s, progress: p } : s))
            );
          },
          promptContext: {
            videoWidth: composition.width,
            videoHeight: composition.height,
            fps: composition.fps,
            durationSeconds,
            category: slotSnapshot.category,
          },
          ...(referenceImages ? { images: referenceImages } : {}),
        });

        const code = genResult.text;

        const saveResult = await window.api.studioTsxSave({
          projectId,
          fileName,
          content: code,
        });
        if (!saveResult.success) {
          throw new Error(saveResult.error ?? 'Failed to save TSX file');
        }

        setSlots((prev) =>
          prev.map((s) =>
            s.slot.id === slotId
              ? {
                  ...s,
                  slot: { ...s.slot, fileName, code },
                  status: 'transpiling' as const,
                  progress: null,
                }
              : s
          )
        );

        // Re-generation: unregister the old component before swapping in the new one.
        unregisterSlotComponent(slotId);
        const { component, sourceDurationSeconds } = await transpileAndLoadComponent(
          projectId,
          fileName
        );
        registerSlotComponent(slotId, component);

        setSlots((prev) => {
          const updated = prev.map((s) =>
            s.slot.id === slotId
              ? {
                  ...s,
                  slot: {
                    ...s.slot,
                    fileName,
                    code,
                    sourceDurationSeconds: sourceDurationSeconds ?? undefined,
                    inPointSeconds: s.slot.inPointSeconds ?? 0,
                  },
                  status: 'ready' as const,
                  progress: null,
                }
              : s
          );
          persistSlots(updated);
          return updated;
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Generation failed';
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.id === slotId
              ? { ...s, status: 'error' as const, error, progress: null }
              : s
          )
        );
      }
    },
    [projectId, composition, persistSlots]
  );

  // Enqueue a slot for generation. Marks it as 'queued' in state and either
  // kicks the processor (if idle) or just appends. Idempotent — if the slot
  // is already running or already in queue, this is a no-op.
  const enqueueForGeneration = useCallback(
    (slotId: string, options?: GenerateSlotOptions) => {
      if (activeSlotIdRef.current === slotId) return;
      if (queueRef.current.some((q) => q.slotId === slotId)) return;

      queueRef.current.push({ slotId, options });
      setSlots((prev) =>
        prev.map((s) =>
          s.slot.id === slotId
            ? { ...s, status: 'queued' as const, error: null, progress: null }
            : s
        )
      );
      // Kick the processor. Safe to call repeatedly — it bails if already running.
      processQueueRef.current();
    },
    []
  );

  // Drain the queue one slot at a time. The LLM engine is single-session so
  // we serialize; the UI hides this behind 'queued' badges + auto-advance.
  const processQueue = useCallback(async () => {
    if (activeSlotIdRef.current !== null) return; // already processing
    const next = queueRef.current.shift();
    if (!next) return;

    // Read the latest slot data via ref so any edits made while queued
    // (custom prompt / new reference images) are picked up at run time.
    const target = slotsRef.current.find((s) => s.slot.id === next.slotId);
    if (!target) {
      // Slot was deleted while queued — skip and try the next one.
      processQueueRef.current();
      return;
    }

    activeSlotIdRef.current = next.slotId;
    try {
      await runGenerationForSlot(target.slot, next.options);
    } finally {
      activeSlotIdRef.current = null;
      // Always advance — even on failure the user wants the rest of the
      // queue to drain. Errors land on individual slots via the catch in
      // runGenerationForSlot.
      processQueueRef.current();
    }
  }, [runGenerationForSlot]);

  // Latest processQueue stored in a ref so the enqueue/cancel paths can call
  // it without forming a circular useCallback dep.
  processQueueRef.current = () => {
    void processQueue();
  };

  // Card entry point — Generate clicked on a suggestion card. Reuses any
  // existing slot for that suggestion (so SlotEditor edits aren't lost) or
  // creates a fresh one, then enqueues.
  const generateSlot = useCallback(
    async (suggestion: TsxSuggestion, options?: GenerateSlotOptions) => {
      if (!projectId || !composition) return;

      const existing = slotsRef.current.find(
        (s) => s.slot.suggestionId === suggestion.id
      );
      if (existing) {
        enqueueForGeneration(existing.slot.id, options);
        return;
      }

      const slotId = `slot_${suggestion.id}_${Date.now()}`;
      const newSlot: TsxSlot = {
        id: slotId,
        suggestionId: suggestion.id,
        title: suggestion.title,
        category: suggestion.category,
        startTime: suggestion.startTime,
        endTime: suggestion.endTime,
        fileName: '',
        code: '',
        description: suggestion.description,
        originalPrompt: suggestion.prompt,
      };
      setSlots((prev) => [
        ...prev,
        { slot: newSlot, status: 'pending', error: null, progress: null },
      ]);
      enqueueForGeneration(slotId, options);
    },
    [projectId, composition, enqueueForGeneration]
  );

  // Seed pending placeholder slots from a fresh suggestions list.
  //
  // Behavior:
  //   - All existing PENDING slots are dropped first. A re-analyze should
  //     replace stale placeholders with the latest AI proposal (otherwise old
  //     ones — including pre-cut-time-fix data — linger at the wrong position).
  //   - Slots in generating / transpiling / ready / error are PRESERVED: the
  //     user has invested in them (file on disk, registered component) and
  //     shouldn't lose that to a re-analyze.
  //   - For each new suggestion, only seed a placeholder if no non-pending slot
  //     already exists for that suggestion id.
  const seedPendingFromSuggestions = useCallback(
    (suggestions: TsxSuggestion[]) => {
      if (suggestions.length === 0) return;
      setSlots((prev) => {
        const survivors = prev.filter((s) => s.status !== 'pending');
        const survivorSuggestionIds = new Set(survivors.map((s) => s.slot.suggestionId));
        const newOnes: SlotRuntime[] = suggestions
          .filter((s) => !survivorSuggestionIds.has(s.id))
          .map((suggestion) => ({
            slot: {
              id: `slot_${suggestion.id}_${Date.now()}`,
              suggestionId: suggestion.id,
              title: suggestion.title,
              category: suggestion.category,
              startTime: suggestion.startTime,
              endTime: suggestion.endTime,
              fileName: '',
              code: '',
              description: suggestion.description,
              originalPrompt: suggestion.prompt,
            },
            status: 'pending' as const,
            error: null,
            progress: null,
          }));
        const next = [...survivors, ...newOnes];
        persistSlots(next);
        return next;
      });
    },
    [persistSlots]
  );

  const updateSlotEditor = useCallback(
    (
      slotId: string,
      patch: { customPrompt?: string; referenceImages?: LlmImageIpc[] }
    ) => {
      setSlots((prev) => {
        const next = prev.map((s) =>
          s.slot.id === slotId
            ? {
                ...s,
                slot: {
                  ...s.slot,
                  ...(patch.customPrompt !== undefined
                    ? { customPrompt: patch.customPrompt }
                    : {}),
                  ...(patch.referenceImages !== undefined
                    ? { referenceImages: patch.referenceImages }
                    : {}),
                },
              }
            : s
        );
        persistSlots(next);
        return next;
      });
    },
    [persistSlots]
  );

  // SlotEditor entry point — Generate clicked from the focused editor.
  // Just enqueues; the processor picks it up.
  const generateFromSlot = useCallback(
    async (slotId: string, options?: GenerateSlotOptions) => {
      const target = slotsRef.current.find((s) => s.slot.id === slotId);
      if (!target) return;
      enqueueForGeneration(slotId, options);
    },
    [enqueueForGeneration]
  );

  // Kick generation for every slot still in 'pending'. Each one enqueues
  // independently so the queue auto-advances and the UI shows them all as
  // 'queued' with their position implied by render order.
  const generateAllPending = useCallback(
    (options?: GenerateSlotOptions) => {
      for (const runtime of slotsRef.current) {
        if (runtime.status === 'pending') {
          enqueueForGeneration(runtime.slot.id, options);
        }
      }
    },
    [enqueueForGeneration]
  );

  const dismissPendingSlot = useCallback(
    (slotId: string) => {
      setSlots((prev) => {
        const target = prev.find((s) => s.slot.id === slotId);
        if (!target || target.status !== 'pending') return prev;
        const next = prev.filter((s) => s.slot.id !== slotId);
        persistSlots(next);
        return next;
      });
    },
    [persistSlots]
  );

  // Cancel-all. Drops every queued slot back to 'pending' and aborts the
  // active LLM call (if any). The active slot's pipeline rejects → its
  // catch block flips it to 'error'. The processor sees the empty queue
  // and stops.
  const cancelActiveGeneration = useCallback(async () => {
    // Drain the queue and reset those slots so they don't sit as 'queued'
    // forever after the abort lands.
    const droppedIds = queueRef.current.map((q) => q.slotId);
    queueRef.current = [];
    if (droppedIds.length > 0) {
      setSlots((prev) =>
        prev.map((s) =>
          droppedIds.includes(s.slot.id)
            ? { ...s, status: 'pending' as const, error: null, progress: null }
            : s
        )
      );
    }
    try {
      await window.api.llmCancel();
    } catch {
      // Best-effort — if the cancel fails, the in-flight promise will still
      // resolve or fail on its own and the slot will leave 'generating'.
    }
  }, []);

  // Per-slot cancel.
  //   - If the slot is queued → drop from queue, flip to 'pending'.
  //   - If the slot is the running one → abort the LLM (engine is single-
  //     session today, so this is the same as cancel-all minus dequeue).
  //   - Otherwise no-op.
  const cancelSlotGeneration = useCallback(
    async (slotId: string) => {
      const inQueueIdx = queueRef.current.findIndex((q) => q.slotId === slotId);
      if (inQueueIdx >= 0) {
        queueRef.current.splice(inQueueIdx, 1);
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.id === slotId
              ? { ...s, status: 'pending' as const, error: null, progress: null }
              : s
          )
        );
        return;
      }
      if (activeSlotIdRef.current === slotId) {
        try {
          await window.api.llmCancel();
        } catch {
          // best-effort
        }
      }
    },
    []
  );

  const getRuntime = useCallback(
    (slotId: string) => slots.find((s) => s.slot.id === slotId) ?? null,
    [slots]
  );

  const addSlotFromFile = useCallback(
    async (sourceFilePath: string, startTime: number, durationSeconds: number) => {
      if (!projectId || !composition) return;

      const baseName = (sourceFilePath.split(/[/\\]/).pop() || 'slot.tsx').replace(/\.tsx$/, '');
      const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const slotId = `slot_lib_${safeName}_${Date.now()}`;
      const fileName = `${slotId}.tsx`;
      const endTime = startTime + durationSeconds;

      setSlots((prev) => [
        ...prev,
        {
          slot: {
            id: slotId,
            suggestionId: slotId,
            title: baseName,
            category: 'custom',
            startTime,
            endTime,
            fileName,
            code: '',
          },
          status: 'transpiling',
          error: null,
          progress: null,
        },
      ]);

      try {
        const readResult = await window.api.fileRead({ path: sourceFilePath });
        if (!readResult.content) {
          throw new Error('Failed to read TSX file');
        }
        const code = readResult.content;

        const saveResult = await window.api.studioTsxSave({
          projectId,
          fileName,
          content: code,
        });
        if (!saveResult.success) {
          throw new Error(saveResult.error ?? 'Failed to save TSX file');
        }

        const { component, sourceDurationSeconds } = await transpileAndLoadComponent(projectId, fileName);
        registerSlotComponent(slotId, component);

        setSlots((prev) => {
          const updated = prev.map((s) =>
            s.slot.id === slotId
              ? {
                  ...s,
                  slot: {
                    ...s.slot,
                    code,
                    sourceDurationSeconds: sourceDurationSeconds ?? undefined,
                    inPointSeconds: 0,
                  },
                  status: 'ready' as const,
                }
              : s
          );
          persistSlots(updated);
          return updated;
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to add slot';
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.id === slotId ? { ...s, status: 'error' as const, error } : s
          )
        );
      }
    },
    [projectId, composition, persistSlots]
  );

  const moveSlot = useCallback(
    (slotId: string, newStartTime: number) => {
      setSlots((prev) => {
        const target = prev.find((s) => s.slot.id === slotId);
        if (!target) return prev;

        const duration = target.slot.endTime - target.slot.startTime;
        // Prefer the timeline working duration when supplied — lets slots
        // move into the post-video padding area, growing the timeline.
        const maxEnd =
          timelineDurationRef?.current ?? composition?.durationInSeconds ?? Infinity;
        const desired = Math.max(0, Math.min(maxEnd - duration, newStartTime));

        // Build allowed start-time intervals from gaps between other slots.
        const others = prev
          .filter((s) => s.slot.id !== slotId)
          .map((s) => ({ startTime: s.slot.startTime, endTime: s.slot.endTime }))
          .sort((a, b) => a.startTime - b.startTime);

        const intervals: { min: number; max: number }[] = [];
        let cursor = 0;
        for (const other of others) {
          const gapEnd = other.startTime - duration;
          if (gapEnd >= cursor) intervals.push({ min: cursor, max: gapEnd });
          cursor = Math.max(cursor, other.endTime);
        }
        const tailMax = maxEnd - duration;
        if (tailMax >= cursor) intervals.push({ min: cursor, max: tailMax });

        // Pick the interval containing `desired`, else the closest one.
        let startTime = desired;
        if (intervals.length > 0) {
          const containing = intervals.find((iv) => desired >= iv.min && desired <= iv.max);
          if (containing) {
            startTime = desired;
          } else {
            let best = intervals[0];
            let bestDist = Infinity;
            for (const iv of intervals) {
              const clamped = Math.max(iv.min, Math.min(iv.max, desired));
              const dist = Math.abs(clamped - desired);
              if (dist < bestDist) {
                bestDist = dist;
                best = iv;
              }
            }
            startTime = Math.max(best.min, Math.min(best.max, desired));
          }
        }

        const endTime = startTime + duration;
        const updated = prev.map((s) =>
          s.slot.id === slotId ? { ...s, slot: { ...s.slot, startTime, endTime } } : s
        );
        persistSlots(updated);
        return updated;
      });
    },
    [persistSlots, composition]
  );

  const trimSlot = useCallback(
    (slotId: string, edge: 'start' | 'end', newTime: number) => {
      setSlots((prev) => {
        const target = prev.find((s) => s.slot.id === slotId);
        if (!target) return prev;

        // Right-edge ceiling. Use the extended timeline duration when present
        // so trimming can stretch a slot into the padding area at the end.
        const videoEnd =
          timelineDurationRef?.current ?? composition?.durationInSeconds ?? Infinity;
        const others = prev.filter((s) => s.slot.id !== slotId);
        const sourceDuration = target.slot.sourceDurationSeconds; // may be undefined for legacy slots
        const inPoint = target.slot.inPointSeconds ?? 0;

        let startTime = target.slot.startTime;
        let endTime = target.slot.endTime;
        let nextInPoint = inPoint;

        if (edge === 'start') {
          // Left edge: keep endTime fixed. Moving startTime also shifts inPoint
          // by the same amount so the remaining source aligns with the new start.
          const leftNeighborEnd = others
            .filter((s) => s.slot.endTime <= startTime)
            .reduce((max, s) => Math.max(max, s.slot.endTime), 0);

          // Lower bound on startTime:
          //   - can't cross left-neighbor end
          //   - can't make inPoint negative → startTime - inPoint (original source start on timeline)
          const sourceStartOnTimeline = startTime - inPoint;
          const minStart = Math.max(leftNeighborEnd, sourceStartOnTimeline);

          // Upper bound: must leave at least MIN duration.
          const maxStart = endTime - MIN_SLOT_DURATION_SECONDS;

          startTime = Math.max(minStart, Math.min(maxStart, newTime));
          nextInPoint = inPoint + (startTime - target.slot.startTime);
          // Floating-point safety: clamp inPoint to [0, currentDuration]
          if (nextInPoint < 0) nextInPoint = 0;
        } else {
          // Right edge: keep startTime + inPoint fixed. Only endTime moves.
          const rightNeighborStart = others
            .filter((s) => s.slot.startTime >= endTime)
            .reduce((min, s) => Math.min(min, s.slot.startTime), videoEnd);

          // Upper bound on endTime:
          //   - can't cross right-neighbor start
          //   - can't exceed source's remaining length:
          //     endTime ≤ startTime + (sourceDuration - inPoint)
          const sourceRemaining = sourceDuration !== undefined ? sourceDuration - inPoint : Infinity;
          const maxEnd = Math.min(rightNeighborStart, startTime + sourceRemaining);

          const minEnd = startTime + MIN_SLOT_DURATION_SECONDS;

          endTime = Math.max(minEnd, Math.min(maxEnd, newTime));
        }

        const updated = prev.map((s) =>
          s.slot.id === slotId
            ? { ...s, slot: { ...s.slot, startTime, endTime, inPointSeconds: nextInPoint } }
            : s
        );
        persistSlots(updated);
        return updated;
      });
    },
    [persistSlots, composition]
  );

  const setSlotTransform = useCallback(
    (slotId: string, transform: LayerTransform | undefined) => {
      setSlots((prev) => {
        const updated = prev.map((s) =>
          s.slot.id === slotId ? { ...s, slot: { ...s.slot, transform } } : s
        );
        persistSlots(updated);
        return updated;
      });
    },
    [persistSlots]
  );

  // History restore. The target list is persisted-slot data (TsxSlot[]); we
  // rebuild runtime around it without losing already-loaded components or any
  // in-flight generation work.
  const restore = useCallback(
    (targetSlots: TsxSlot[] | undefined) => {
      const target = targetSlots ?? [];
      const targetIds = new Set(target.map((s) => s.id));
      const current = slotsRef.current;
      const byId = new Map(current.map((rt) => [rt.slot.id, rt]));

      // Drop components for slots leaving the project — but keep transient
      // generating/queued runtimes so an undo doesn't kill active work.
      const preserved: SlotRuntime[] = [];
      for (const rt of current) {
        if (targetIds.has(rt.slot.id)) continue;
        if (rt.status === 'generating' || rt.status === 'queued') {
          preserved.push(rt);
          continue;
        }
        unregisterSlotComponent(rt.slot.id);
      }

      const needsTranspile: TsxSlot[] = [];
      const next: SlotRuntime[] = target.map((slot) => {
        const existing = byId.get(slot.id);
        if (existing && (existing.status === 'generating' || existing.status === 'queued')) {
          return { ...existing, slot };
        }
        if (existing && existing.slot.fileName === slot.fileName && getSlotComponent(slot.id)) {
          return { ...existing, slot, status: 'ready' as const, error: null, progress: null };
        }
        if (!slot.fileName) {
          return { slot, status: 'pending' as const, error: null, progress: null };
        }
        needsTranspile.push(slot);
        return { slot, status: 'transpiling' as const, error: null, progress: null };
      });

      setSlots([...next, ...preserved]);
      persistSlots(next);

      for (const slot of needsTranspile) {
        if (!projectId) break;
        transpileAndLoadComponent(projectId, slot.fileName)
          .then(({ component, sourceDurationSeconds }) => {
            registerSlotComponent(slot.id, component);
            setSlots((prev) =>
              prev.map((s) =>
                s.slot.id === slot.id
                  ? {
                      ...s,
                      status: 'ready',
                      slot: {
                        ...s.slot,
                        sourceDurationSeconds:
                          s.slot.sourceDurationSeconds ?? (sourceDurationSeconds ?? undefined),
                      },
                    }
                  : s
              )
            );
          })
          .catch((err) => {
            const error = err instanceof Error ? err.message : 'Failed to load';
            setSlots((prev) =>
              prev.map((s) => (s.slot.id === slot.id ? { ...s, status: 'error', error } : s))
            );
          });
      }
    },
    [projectId, persistSlots]
  );

  const removeSlot = useCallback(
    (slotId: string) => {
      unregisterSlotComponent(slotId);
      setSlots((prev) => {
        const updated = prev.filter((s) => s.slot.id !== slotId);
        persistSlots(updated);
        return updated;
      });
    },
    [persistSlots]
  );

  const splitAtTime = useCallback(
    (timeInSeconds: number): boolean => {
      // Only split runtime-ready slots (others have no registered component yet).
      const splittable = slots.filter((s) => s.status === 'ready');
      const splittableClips = splittable.map((s) => s.slot);
      const { splits } = splitClipsAtTime(splittableClips, timeInSeconds);
      if (splits.length === 0) return false;

      // Clone each split's component registration under the right-half id so
      // the new sibling renders the same TSX content.
      for (const split of splits) {
        const component = getSlotComponent(split.original.id);
        if (component) registerSlotComponent(split.right.id, component);
      }

      setSlots((prev) => {
        const out: SlotRuntime[] = [];
        for (const runtime of prev) {
          const split = splits.find((s) => s.original.id === runtime.slot.id);
          if (!split) {
            out.push(runtime);
            continue;
          }
          out.push({ ...runtime, slot: split.left });
          out.push({ ...runtime, slot: split.right });
        }
        persistSlots(out);
        return out;
      });
      return true;
    },
    [slots, persistSlots]
  );

  const getStatusForSuggestion = useCallback(
    (suggestionId: string) => {
      const runtime = slots.find((s) => s.slot.suggestionId === suggestionId);
      if (!runtime) return null;
      return {
        slotId: runtime.slot.id,
        status: runtime.status,
        error: runtime.error,
        progress: runtime.progress,
      };
    },
    [slots]
  );

  return {
    slots,
    generateSlot,
    seedPendingFromSuggestions,
    updateSlotEditor,
    generateFromSlot,
    generateAllPending,
    dismissPendingSlot,
    cancelActiveGeneration,
    cancelSlotGeneration,
    addSlotFromFile,
    moveSlot,
    trimSlot,
    setSlotTransform,
    restore,
    removeSlot,
    splitAtTime,
    getStatusForSuggestion,
    getRuntime,
  };
}
