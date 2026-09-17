import { useMemo } from 'react';
import { ParamField } from '@shared/components';
import type { TemplateControl } from '@shared/types/templates';
import type { TemplateSession } from '../../hooks/useTemplateSession';
import { MotionSegmented } from '../MotionSegmented';

interface TemplateFormProps {
  session: TemplateSession;
}

interface ControlGroup {
  label: string | null;
  controls: TemplateControl[];
}

/** Consecutive controls sharing a `group` render under one heading. */
function groupControls(controls: TemplateControl[]): ControlGroup[] {
  const groups: ControlGroup[] = [];
  for (const control of controls) {
    const label = control.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.controls.push(control);
    else groups.push({ label, controls: [control] });
  }
  return groups;
}

function Heading({ children }: { children: string }) {
  return (
    <div className="text-[9px] font-medium uppercase tracking-[0.08em] text-text-dim">{children}</div>
  );
}

/**
 * Templates mode, one template open: the form the manifest declares. It
 * replaces the Edit prompt — a template is changed by filling this in, and the
 * preview follows every keystroke.
 */
export function TemplateForm({ session }: TemplateFormProps) {
  const { template, values, format, activePresetId } = session;
  const groups = useMemo(() => (template ? groupControls(template.manifest.controls) : []), [template]);
  if (!template) return null;

  const { manifest } = template;
  const busy = session.status === 'preparing';

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-template-form={manifest.id}>
      <div className="px-3 pb-2 shrink-0 flex flex-col gap-1">
        <button
          onClick={session.close}
          className="self-start flex items-center gap-1 text-[10px] text-text-dim hover:text-text-primary transition-colors cursor-pointer"
        >
          <svg width={8} height={8} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 2L3.5 5L6.5 8" />
          </svg>
          Templates
        </button>
        <div className="text-[13px] font-medium text-text-primary">{manifest.name}</div>
        {manifest.description && (
          <div className="text-[10px] text-text-dim leading-snug line-clamp-3" title={manifest.description}>
            {manifest.description}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {manifest.formats && format && (
          <div className="pt-3">
            <MotionSegmented
              label="Format"
              options={manifest.formats.options.map((o) => ({ value: o.value, label: o.label }))}
              value={format.value}
              onChange={session.setFormat}
              disabled={busy}
            />
          </div>
        )}

        {manifest.presets.length > 0 && (
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            <Heading>Looks</Heading>
            <div className="flex flex-wrap gap-1">
              {manifest.presets.map((preset) => {
                const active = preset.id === activePresetId;
                return (
                  <button
                    key={preset.id}
                    onClick={() => session.applyPreset(preset.id)}
                    disabled={busy}
                    aria-pressed={active}
                    data-preset={preset.id}
                    className={`px-2 py-[4px] rounded-[6px] text-[10px] transition-colors duration-150 cursor-pointer disabled:opacity-50 ${
                      active ? 'bg-app-active text-accent-light' : 'text-text-muted hover:bg-app-hover'
                    }`}
                    style={{ border: `0.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}` }}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {groups.map((group, i) => (
          <div
            key={`${group.label ?? 'group'}-${i}`}
            className="px-3 py-3 flex flex-col gap-3"
            style={{ borderTop: '0.5px solid var(--color-border)' }}
          >
            {group.label && <Heading>{group.label}</Heading>}
            {group.controls.map((control) => (
              <ParamField
                key={control.key}
                control={control}
                value={values[control.key] ?? control.default}
                onChange={(value) => session.setValue(control.key, value)}
                onPickImage={control.type === 'image' ? () => { void session.pickImage(control.key); } : undefined}
                imageUrl={control.type === 'image' ? session.imageUrlFor(values[control.key] ?? '') : undefined}
                disabled={busy}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        className="shrink-0 px-3 py-2 flex items-center justify-between gap-2"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[9px] text-text-dim">Saved automatically</span>
        <button
          onClick={session.reset}
          disabled={!session.isCustomized || busy}
          className="text-[10px] text-text-dim hover:text-text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
