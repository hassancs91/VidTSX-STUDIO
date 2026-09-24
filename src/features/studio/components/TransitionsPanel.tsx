// The Transitions tab (docs/studio/TRANSITION_PACKS_DESIGN.md "UI"): the
// selected join up top — its transition, length and Remove — and below it a
// gallery of every transition, grouped by pack, each card a live preview of
// the real component. A card click applies to the selected join; with no join
// selected the panel says so instead of guessing.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { useToast } from '@renderer/contexts/ToastContext';
import type { StudioTransitionInfo } from '@shared/ipc/types';
import { useTransitionComponents, type TransitionList } from '../hooks/useTransitions';
import { JOIN_WARNING_TEXT, type JoinTargetInfo } from '../services/join-status';
import { MIN_TRANSITION_DURATION } from '../services/transition-ops';
import { formatDuration } from '../services/format-time';
import { Field, NumberField } from './inspector-controls';
import { TransitionCard } from './TransitionCard';
import { ImportPackDialog } from './ImportPackDialog';
import { NATIVE_CARDS, cardCompositionSize } from './transition-demo-scenes';

interface Props {
  list: TransitionList;
  /** The join a card click applies to; null = nothing selected. */
  target: JoinTargetInfo | null;
  /** Project frame size — cards preview in its aspect. */
  width: number;
  height: number;
  onApply: (kind: string, durationSeconds: number) => void;
  onDuration: (seconds: number) => void;
  onRemove: () => void;
}

const NO_TARGET = 'Select a join on the timeline first: the small square between two clips.';
const SOUND_ONLY = 'This join is sound only. Use Crossfade or Dip to black here.';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Installed transitions grouped by pack, in list order (built-ins scan first). */
function groupByPack(transitions: readonly StudioTransitionInfo[]) {
  const groups = new Map<string, { name: string; items: StudioTransitionInfo[] }>();
  for (const t of transitions) {
    const group = groups.get(t.packId) ?? { name: t.packName, items: [] };
    group.items.push(t);
    groups.set(t.packId, group);
  }
  return [...groups.entries()].map(([packId, group]) => ({ packId, ...group }));
}

export function TransitionsPanel({ list, target, width, height, onApply, onDuration, onRemove }: Props) {
  const { transitions, installed, loading, refresh } = list;
  // Every open re-scans the pack roots: a folder-dropped pack appears here.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Import: main owns the OS picker, so the first inspect only picks; the
  // dialog then reads the file itself (and shows why when it can't).
  const { showToast } = useToast();
  const [importPath, setImportPath] = useState<string | null>(null);
  const pickPackage = useCallback(async () => {
    const result = await window.api.studioPackPackageInspect({ pick: ['transition'] });
    if (result.filePath) setImportPath(result.filePath);
    else if (!result.canceled) showToast(result.error ?? 'That file is not a transition package.', 'error');
  }, [showToast]);

  // Modules load as their cards scroll into view.
  const [visible, setVisible] = useState<string[]>([]);
  const onVisible = useCallback(
    (kind: string) => setVisible((prev) => (prev.includes(kind) ? prev : [...prev, kind])),
    [],
  );
  const components = useTransitionComponents(visible, installed);
  const groups = useMemo(() => groupByPack(transitions), [transitions]);
  const card = cardCompositionSize(width, height);

  const status = target?.status ?? null;
  const currentKind = status?.kind ?? null;
  const blockedFor = (native: boolean): string | null =>
    !target ? NO_TARGET : !native && !target.pictureJoin ? SOUND_ONLY : null;
  const shared = {
    compositionWidth: card.width,
    compositionHeight: card.height,
    onVisible,
    onPick: onApply,
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-transitions-panel>
      <Section title="Selected join">
        {!target ? (
          <div className="text-[10px] text-text-dim leading-relaxed" data-join-target="">
            {NO_TARGET} Or select one clip to target its out-join. Then click a transition below.
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-join-target={target.leadId}>
            <div className="text-[10px] text-text-muted leading-relaxed min-w-0">
              <span className="text-text-secondary">{target.leadLabel}</span>
              <span className="text-text-dim"> → </span>
              <span className="text-text-secondary">{target.trailLabel}</span>
              <span className="text-text-dim"> · at {formatDuration(target.at)}</span>
            </div>
            {status ? (
              <>
                <div className="flex items-end gap-1.5">
                  <div className="flex-1 min-w-0">
                    <Field label="Transition">
                      <div
                        className="h-[26px] flex items-center px-2 rounded-[6px] bg-app-base text-[11px] text-text-secondary truncate"
                        style={{ border: '0.5px solid var(--color-border)' }}
                        data-transition-current={status.kind}
                      >
                        {status.name}
                      </div>
                    </Field>
                  </div>
                  <div className="w-[68px] shrink-0" data-transition-duration>
                    <Field label="Length">
                      <NumberField
                        value={round2(status.seconds)}
                        min={MIN_TRANSITION_DURATION}
                        max={round2(target.maxSeconds)}
                        suffix="s"
                        onCommit={onDuration}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-[26px] flex items-center"
                    onClick={onRemove}
                    title="Remove the transition (a hard cut again)"
                    data-transition-remove
                  >
                    <Trash2 size={12} strokeWidth={1.75} />
                  </Button>
                </div>
                {status.warning ? (
                  <Note warning={status.warning}>{JOIN_WARNING_TEXT[status.warning]}</Note>
                ) : status.short ? (
                  <div className="text-[10px] text-text-dim leading-relaxed">
                    Plays {round2(status.playsSeconds)} s of {round2(status.seconds)} s: the clips run
                    out of footage past the cut. Trim them to leave room.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-[10px] text-text-dim">No transition. Click one below to add it.</div>
            )}
            {!target.pictureJoin && <div className="text-[10px] text-text-dim leading-relaxed">{SOUND_ONLY}</div>}
          </div>
        )}
      </Section>

      <Section title="Basic">
        <div className="grid grid-cols-2 gap-1.5">
          {NATIVE_CARDS.map((native) => (
            <TransitionCard
              key={native.kind}
              kind={native.kind}
              name={native.name}
              description={native.description}
              durationSeconds={native.durationSeconds}
              heavy={false}
              component={native.component}
              active={currentKind === native.kind}
              blockedReason={blockedFor(true)}
              {...shared}
            />
          ))}
        </div>
      </Section>

      {loading && transitions.length === 0 ? (
        <Section title="Packs">
          <div className="text-[10px] text-text-dim">Loading transitions…</div>
        </Section>
      ) : groups.length === 0 ? (
        <Section title="Packs">
          <div className="text-[10px] text-text-dim leading-relaxed">
            No transition packs found. Drop a pack folder into the assets root’s <code>packs/</code>{' '}
            folder to install one.
          </div>
        </Section>
      ) : (
        groups.map((group) => (
          <Section key={group.packId} title={group.name}>
            <div className="grid grid-cols-2 gap-1.5" data-transition-pack={group.packId}>
              {group.items.map((t) => (
                <TransitionCard
                  key={t.kind}
                  kind={t.kind}
                  name={t.name}
                  {...(t.description ? { description: t.description } : {})}
                  {...(t.usage ? { usage: t.usage } : {})}
                  durationSeconds={t.durationSeconds}
                  heavy={t.sceneCopies === 'multi'}
                  component={components?.[t.kind]}
                  active={currentKind === t.kind}
                  blockedReason={blockedFor(false)}
                  {...shared}
                />
              ))}
            </div>
          </Section>
        ))
      )}

      <Section title="More transitions">
        <div className="text-[10px] text-text-dim leading-relaxed">
          Import a pack (.vidtsxpack) or a single transition (.vidtsxtransition). Double-clicking one does the same.
        </div>
        <div>
          <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => void pickPackage()} data-transition-import>
            <Download size={12} strokeWidth={1.75} />
            Import…
          </Button>
        </div>
      </Section>

      {importPath && <ImportPackDialog filePath={importPath} onClose={() => setImportPath(null)} />}
    </div>
  );
}

function Note({ warning, children }: { warning: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5 text-[10px] leading-relaxed text-accent-amber" data-join-warning={warning}>
      <TriangleAlert size={12} strokeWidth={1.75} className="shrink-0 mt-[1px]" />
      <span>{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-2.5" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="text-[11px] font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
