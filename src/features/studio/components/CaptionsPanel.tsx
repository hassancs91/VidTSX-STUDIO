// The Captions panel (CAPTIONS_DESIGN.md §C4): template gallery + style
// controls. Each gallery card is a tiny looping <Player> running the real
// template over sample words — the same component the timeline renders, so
// what the card shows is what the export produces. Cards mount lazily (only
// when scrolled into view) and unmount with the panel.
//
// Captions are derived, never authored here: transcript fixes happen in the
// transcript panel and flow through on the next serialize.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { Captions, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { aspectOf, resolveCaptionPalette, resolvedStyle } from '@shared/studio';
import type { StudioCaptionTemplateInfo } from '@shared/ipc/types';
import type {
  CaptionGroup,
  StudioCaptionLayer,
  StudioCaptionStyle,
  StudioProject,
} from '../types';
import type { BrandOption } from '../hooks/useBrandList';
import {
  useCaptionTemplateList,
  useCaptionTemplateModules,
  type CaptionComponent,
} from '../hooks/useCaptionTemplates';
import { Field, SliderField } from './inspector-controls';

/** Preview loop length for a gallery card, in seconds. */
const CARD_SECONDS = 3;
const CARD_FPS = 30;

interface Props {
  project: StudioProject;
  layer: StudioCaptionLayer | null;
  /** The project's active brand, for 'brand'-colored previews. */
  brand: BrandOption | null;
  /** How many words the current edit actually derives (0 = nothing to show). */
  wordCount: number;
  /** Master-lane clips with no transcript — the honest "why is it empty". */
  untranscribedCount: number;
  onApply: (templateId: string, seed?: { scale?: number; wordsPerGroup?: number }) => void;
  onStyle: (patch: Partial<StudioCaptionStyle>) => void;
  onSetEnabled: (enabled: boolean) => void;
  onRemove: () => void;
}

/** Sample groups for a gallery card, spaced evenly across the loop. */
function sampleGroups(words: string[] | undefined, wordsPerGroup: number): CaptionGroup[] {
  const list = words && words.length > 0 ? words : ['your', 'words', 'here'];
  const per = Math.max(1, Math.min(6, wordsPerGroup));
  const step = CARD_SECONDS / list.length;
  const groups: CaptionGroup[] = [];
  for (let i = 0; i < list.length; i += per) {
    const slice = list.slice(i, i + per).map((text, index) => ({
      text,
      start: (i + index) * step,
      end: (i + index + 1) * step,
    }));
    groups.push({ start: slice[0].start, end: slice[slice.length - 1].end, words: slice });
  }
  return groups;
}

/** The card composition: the real template over sample words. */
function CardComposition({
  Template,
  groups,
  style,
  palette,
}: {
  Template: CaptionComponent;
  groups: CaptionGroup[];
  style: ReturnType<typeof resolvedStyle>;
  palette: ReturnType<typeof resolveCaptionPalette>;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#101014' }}>
      <Template groups={groups} style={style} palette={palette} />
    </AbsoluteFill>
  );
}

export function CaptionsPanel({
  project,
  layer,
  brand,
  wordCount,
  untranscribedCount,
  onApply,
  onStyle,
  onSetEnabled,
  onRemove,
}: Props) {
  const { templates, loading } = useCaptionTemplateList();
  const { width, height } = project.settings;
  const aspect = aspectOf(width, height);

  // Lazy card mounting: only templates scrolled into view get transpiled.
  const [visible, setVisible] = useState<string[]>([]);
  const wanted = useMemo(
    () => (layer ? [...new Set([layer.templateId, ...visible])] : visible),
    [layer, visible],
  );
  const components = useCaptionTemplateModules(wanted);

  const style = layer?.style ?? null;
  const palette = useMemo(
    () => resolveCaptionPalette(style?.colors ?? 'brand', brand),
    [style?.colors, brand],
  );

  const missingTemplate =
    layer !== null && !loading && !templates.some((t) => t.templateId === layer.templateId);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <Section title="Captions">
        {layer ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSetEnabled(!layer.enabled)}
                title={layer.enabled ? 'Hide captions without losing the style' : 'Show captions'}
              >
                {layer.enabled ? (
                  <EyeOff size={12} strokeWidth={1.75} />
                ) : (
                  <Eye size={12} strokeWidth={1.75} />
                )}
                {layer.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRemove}
                title="Remove the caption layer entirely"
              >
                <Trash2 size={12} strokeWidth={1.75} />
                Remove
              </Button>
            </div>
            <div className="text-[10px] text-text-dim leading-relaxed">
              {missingTemplate ? (
                <span className="text-accent-amber">
                  The pack for “{layer.templateId}” isn’t installed — captions stay in the project
                  and come back when it is. Pick another style below to change it.
                </span>
              ) : wordCount > 0 ? (
                <>
                  {wordCount} word{wordCount === 1 ? '' : 's'} from the master lane — captions
                  follow every cut automatically.
                </>
              ) : (
                <>Nothing to caption yet on the master lane.</>
              )}
              {untranscribedCount > 0 && (
                <>
                  {' '}
                  <span className="text-accent-amber">
                    {untranscribedCount} clip{untranscribedCount === 1 ? ' has' : 's have'} no
                    transcript — transcribe for captions there.
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-text-dim leading-relaxed">
            Pick a style to caption the master lane. Words come from the clips’ transcripts and
            re-derive on every edit — nothing is baked.
          </div>
        )}
      </Section>

      <Section title="Style gallery">
        {loading ? (
          <div className="text-[10px] text-text-dim">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-[10px] text-text-dim">
            No caption packs found. Drop a pack folder into the assets root’s <code>packs/</code>{' '}
            folder to install one.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {templates.map((template) => (
              <GalleryCard
                key={template.templateId}
                template={template}
                active={layer?.templateId === template.templateId}
                aspect={aspect}
                width={width}
                height={height}
                component={components[template.templateId] ?? null}
                style={style}
                palette={palette}
                onVisible={() =>
                  setVisible((prev) =>
                    prev.includes(template.templateId) ? prev : [...prev, template.templateId],
                  )
                }
                onPick={() =>
                  onApply(template.templateId, template ? seedFor(template, aspect) : undefined)
                }
              />
            ))}
          </div>
        )}
      </Section>

      {layer && style && (
        <Section title="Adjust">
          <Field label="Position" asDiv>
            <div className="flex gap-1">
              {(['top', 'center', 'bottom'] as const).map((position) => (
                <button
                  key={position}
                  onClick={() => onStyle({ position })}
                  className={`flex-1 h-[24px] rounded-[5px] text-[10px] capitalize transition-colors ${
                    style.position === position
                      ? 'bg-app-active text-text-primary'
                      : 'text-text-muted hover:bg-app-hover'
                  }`}
                  style={{ border: '0.5px solid var(--color-border)' }}
                >
                  {position}
                </button>
              ))}
            </div>
          </Field>

          <SliderField
            label="Size"
            value={Math.round(style.scale * 100)}
            min={50}
            max={200}
            unit="%"
            onCommit={(value) => onStyle({ scale: value / 100 })}
          />

          <SliderField
            label="Words per group"
            value={style.wordsPerGroup}
            min={1}
            max={6}
            unit=""
            onCommit={(value) => onStyle({ wordsPerGroup: value })}
          />

          <label className="flex items-center gap-2 text-[10px] text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={style.uppercase}
              onChange={(e) => onStyle({ uppercase: e.target.checked })}
              className="accent-accent"
            />
            UPPERCASE
          </label>

          <label className="flex items-center gap-2 text-[10px] text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={style.colors === 'brand'}
              onChange={(e) =>
                onStyle({
                  colors: e.target.checked
                    ? 'brand'
                    : {
                        primary: palette.primary,
                        secondary: palette.secondary,
                        background: palette.background,
                        text: palette.text,
                        accent: palette.accent,
                      },
                })
              }
              className="accent-accent"
            />
            Use brand colors
            {brand ? <span className="text-text-ghost">· {brand.name}</span> : null}
          </label>

          {style.colors !== 'brand' && (
            <div className="flex flex-col gap-1">
              {(['text', 'accent', 'background'] as const).map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={toHex(
                      style.colors === 'brand' ? palette[role] : style.colors[role],
                    )}
                    onChange={(e) =>
                      onStyle({
                        colors:
                          style.colors === 'brand'
                            ? style.colors
                            : { ...style.colors, [role]: e.target.value },
                      })
                    }
                    className="w-[26px] h-[20px] bg-transparent cursor-pointer"
                    aria-label={`Caption ${role} color`}
                  />
                  <span className="text-[10px] text-text-dim capitalize">{role}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/** Manifest seeds for the project's aspect — applied on first pick only. */
function seedFor(
  template: StudioCaptionTemplateInfo,
  aspect: ReturnType<typeof aspectOf>,
): { scale?: number; wordsPerGroup?: number } | undefined {
  return template.defaults?.[aspect];
}

/** #rrggbb for <input type="color">, which rejects anything else. */
function toHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  return '#ffffff';
}

function GalleryCard({
  template,
  active,
  width,
  height,
  component,
  style,
  palette,
  onVisible,
  onPick,
}: {
  template: StudioCaptionTemplateInfo;
  active: boolean;
  aspect: ReturnType<typeof aspectOf>;
  width: number;
  height: number;
  component: CaptionComponent | null;
  style: StudioCaptionStyle | null;
  palette: ReturnType<typeof resolveCaptionPalette>;
  onVisible: () => void;
  onPick: () => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || notified.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !notified.current) {
        notified.current = true;
        onVisible();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);

  const groups = useMemo(
    () => sampleGroups(template.sampleWords, style?.wordsPerGroup ?? 3),
    [template.sampleWords, style?.wordsPerGroup],
  );
  const inputProps = useMemo(
    () =>
      component
        ? {
            Template: component,
            groups,
            style: resolvedStyle(
              style ?? {
                position: 'center',
                scale: 1,
                wordsPerGroup: 3,
                uppercase: false,
                colors: 'brand',
              },
            ),
            palette,
          }
        : null,
    [component, groups, style, palette],
  );

  return (
    <button
      ref={ref}
      onClick={onPick}
      title={template.description ?? template.name}
      data-caption-template={template.templateId}
      className={`flex flex-col rounded-[6px] overflow-hidden text-left transition-colors ${
        active ? 'bg-app-active' : 'bg-app-surface hover:bg-app-hover'
      }`}
      style={{
        border: active
          ? '0.5px solid var(--color-accent, #7F77DD)'
          : '0.5px solid var(--color-border)',
      }}
    >
      <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
        {inputProps ? (
          <Player
            component={CardComposition}
            inputProps={inputProps}
            durationInFrames={CARD_SECONDS * CARD_FPS}
            fps={CARD_FPS}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            autoPlay
            loop
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-text-ghost">
            {component === null ? 'Preview…' : ''}
          </div>
        )}
      </div>
      <div className="px-1.5 py-1 flex items-center gap-1">
        {active && <Captions size={10} strokeWidth={2} className="text-accent shrink-0" />}
        <span className="text-[10px] text-text-secondary truncate">{template.name}</span>
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-2 p-2.5"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[11px] font-medium text-text-muted">{title}</span>
      {children}
    </div>
  );
}
