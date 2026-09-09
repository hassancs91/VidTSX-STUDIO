import { useState } from 'react';
import type { StudioPresetEntry, StudioPresetStyle } from '@shared/types/studio-preset';
import { PRESET_BODY_MAX, PRESET_PROMPT_BUDGET } from '@shared/types/studio-preset';
import { validatePresetInput, type StudioPresetInput } from '@shared/studio/preset';
import { formatWorkflowLines, parseWorkflowLines } from '@shared/studio/preset-workflow-lines';

const EMPTY: StudioPresetInput = {
  name: '',
  description: '',
  videoKind: 'custom',
  workflow: [],
  style: {},
  body: '',
};

const DEFAULT_WORKFLOW = 'transcribe\nauto_cut:normal\neditorial\nshots:2\ncaptions';

const inputClass =
  'h-[26px] px-2 rounded bg-app-base text-text-primary text-[11px] focus:outline-none w-full';
const selectClass = `${inputClass} appearance-none`;
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;
const areaClass =
  'px-2 py-1.5 rounded bg-app-base text-text-primary text-[11px] focus:outline-none resize-y font-mono leading-snug w-full';

/** Create/edit form for one preset (V1 completion plan §2.5) — validation
 *  mirrors the store's. The workflow is typed one step per line
 *  (`auto_cut:aggressive`); PRESET.md is a plain markdown editor. */
export function PresetForm({
  preset,
  brands,
  onSave,
  onCancel,
}: {
  /** undefined = create */
  preset?: StudioPresetEntry;
  brands: Array<{ id: string; name: string }>;
  onSave: (input: StudioPresetInput, presetId?: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<StudioPresetInput>(
    preset
      ? {
          name: preset.name,
          description: preset.description ?? '',
          videoKind: preset.videoKind,
          ...(preset.orientation ? { orientation: preset.orientation } : {}),
          ...(preset.defaultBrandId ? { defaultBrandId: preset.defaultBrandId } : {}),
          workflow: preset.workflow.map((s) => ({ ...s })),
          style: { ...preset.style },
          body: preset.body,
        }
      : EMPTY,
  );
  const [workflowText, setWorkflowText] = useState(
    preset ? formatWorkflowLines(preset.workflow) : DEFAULT_WORKFLOW,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setStyle = (patch: Partial<StudioPresetStyle>) =>
    setInput({ ...input, style: { ...input.style, ...patch } });

  const numberOrUndefined = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));

  const submit = async () => {
    const parsed = parseWorkflowLines(workflowText);
    const next: StudioPresetInput = { ...input, workflow: parsed.steps };
    const problems = [...parsed.errors, ...validatePresetInput(next)];
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    const error = await onSave(next, preset?.id);
    setSaving(false);
    if (error) setErrors([error]);
    else onCancel();
  };

  const overBudget = input.body.length > PRESET_PROMPT_BUDGET;

  return (
    <div className="flex flex-col gap-2" data-preset-form>
      <div className="grid grid-cols-[1fr_120px_90px] gap-x-3 gap-y-1.5">
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Name
          <input
            autoFocus
            value={input.name}
            onChange={(e) => setInput({ ...input, name: e.target.value })}
            placeholder="My shorts"
            data-preset-name
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Kind
          <select
            value={input.videoKind}
            onChange={(e) => setInput({ ...input, videoKind: e.target.value as StudioPresetInput['videoKind'] })}
            data-preset-kind
            className={selectClass}
            style={inputStyle}
          >
            <option value="short">Short</option>
            <option value="long">Long-form</option>
            <option value="course">Course</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Orientation
          <select
            value={input.orientation ?? ''}
            onChange={(e) => {
              const { orientation: _o, ...rest } = input;
              const value = e.target.value as StudioPresetInput['orientation'] | '';
              setInput(value ? { ...rest, orientation: value } : rest);
            }}
            className={selectClass}
            style={inputStyle}
          >
            <option value="">Any</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Description (one line, shown in pickers)
        <input
          value={input.description ?? ''}
          onChange={(e) => setInput({ ...input, description: e.target.value })}
          className={inputClass}
          style={inputStyle}
        />
      </label>

      {brands.length > 0 && (
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Default brand (new projects on this preset start with it; the brand itself is never changed)
          <select
            value={input.defaultBrandId ?? ''}
            onChange={(e) => {
              const { defaultBrandId: _b, ...rest } = input;
              setInput(e.target.value ? { ...rest, defaultBrandId: e.target.value } : rest);
            }}
            className={selectClass}
            style={inputStyle}
          >
            <option value="">Library default</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Workflow — one step per line, in order: transcribe[:engine], auto_cut[:light|normal|aggressive],
        editorial, shots[:per-minute], broll[:library|generate], sfx, music, captions[:template], export
        <textarea
          value={workflowText}
          onChange={(e) => setWorkflowText(e.target.value)}
          rows={5}
          data-preset-workflow
          className={areaClass}
          style={inputStyle}
        />
      </label>

      <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Pacing
          <select
            value={input.style.pacing ?? ''}
            onChange={(e) => setStyle({ pacing: (e.target.value || undefined) as StudioPresetStyle['pacing'] })}
            data-preset-pacing
            className={selectClass}
            style={inputStyle}
          >
            <option value="">—</option>
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Shots / min
          <input type="number" min={0} max={30} step={0.5} value={input.style.shotsPerMinute ?? ''} onChange={(e) => setStyle({ shotsPerMinute: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          SFX / min
          <input type="number" min={0} max={60} step={0.5} value={input.style.sfxPerMinute ?? ''} onChange={(e) => setStyle({ sfxPerMinute: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Music bed
          <select value={input.style.musicBed ?? ''} onChange={(e) => setStyle({ musicBed: (e.target.value || undefined) as StudioPresetStyle['musicBed'] })} className={selectClass} style={inputStyle}>
            <option value="">—</option>
            <option value="none">None</option>
            <option value="quiet">Quiet</option>
            <option value="present">Present</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Captions
          <select value={input.style.captions ?? ''} onChange={(e) => setStyle({ captions: (e.target.value || undefined) as StudioPresetStyle['captions'] })} className={selectClass} style={inputStyle}>
            <option value="">—</option>
            <option value="none">None</option>
            <option value="karaoke">Karaoke</option>
            <option value="block">Block</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Intro (s)
          <input type="number" min={0} max={120} value={input.style.introSeconds ?? ''} onChange={(e) => setStyle({ introSeconds: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Outro (s)
          <input type="number" min={0} max={120} value={input.style.outroSeconds ?? ''} onChange={(e) => setStyle({ outroSeconds: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Transitions
          <input
            value={(input.style.transitions ?? []).join(', ')}
            onChange={(e) => setStyle({ transitions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="crossfade"
            className={inputClass}
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        <span>
          PRESET.md — the instructions the assistant reads (markdown).{' '}
          <span className={overBudget ? 'text-accent-amber' : 'text-text-dim'} data-preset-body-count>
            {input.body.length.toLocaleString()} / {PRESET_BODY_MAX.toLocaleString()} chars
            {overBudget
              ? ` · the first ${PRESET_PROMPT_BUDGET.toLocaleString()} ride every turn, the rest is read on demand`
              : ''}
          </span>
        </span>
        <textarea
          value={input.body}
          onChange={(e) => setInput({ ...input, body: e.target.value })}
          rows={14}
          spellCheck={false}
          data-preset-body
          placeholder={'# My shorts\n\n## The hook rule\n\n- The first line on the timeline is the strongest claim…'}
          className={areaClass}
          style={inputStyle}
        />
      </label>

      {errors.length > 0 && (
        <div className="text-[10px] text-accent-red leading-snug" data-preset-errors>
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-[11px] text-text-secondary hover:bg-app-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          data-preset-save
          className="px-3 py-1.5 rounded bg-accent text-white text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : preset ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
}
