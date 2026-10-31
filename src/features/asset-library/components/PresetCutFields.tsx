import { useState } from 'react';
import type { StudioPresetStyle } from '@shared/types/studio-preset';
import type { CutPlanKnob, CutStyleFile } from '@shared/types/studio-cut-plan';
import { CUT_PLAN_KNOBS, isCutPlanStyleName } from '@shared/studio/cut-style-spec';
import { CUT_KNOB_INFO, formatCutKnob } from '@shared/studio/cut-style-labels';
import { pacingToCutBase } from '@shared/studio/cut-style-resolve';
import { cutSpecProblems, presetCutBase, withPresetCutBase, withPresetCutKnob } from '@shared/studio/preset-cut';

const inputClass =
  'h-[26px] px-2 rounded bg-app-base text-text-primary text-[11px] focus:outline-none w-full';
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;
const labelClass = 'flex flex-col gap-1 text-[10px] text-text-muted';

interface Props {
  style: StudioPresetStyle;
  /** The shipped cut styles (from main); null while loading or after a failure. */
  file: CutStyleFile | null;
  fileError: string | null;
  onChange: (style: StudioPresetStyle) => void;
}

/**
 * One knob. Local text, so a half-typed "0." is not snapped back; every finite
 * number commits, an empty field goes back to the base (shown as placeholder).
 */
function KnobInput({
  knob,
  value,
  baseValue,
  baseName,
  onCommit,
}: {
  knob: CutPlanKnob;
  value: number;
  baseValue: number;
  baseName: string;
  onCommit: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number"
      step={CUT_KNOB_INFO[knob].step}
      value={text}
      placeholder={String(baseValue)}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.trim();
        const n = Number(raw);
        if (raw === '') onCommit(undefined);
        else if (Number.isFinite(n)) onCommit(n);
      }}
      title={`${CUT_KNOB_INFO[knob].hint} Base ${baseName}: ${baseValue}. Empty = the base's value.`}
      data-preset-cut-knob={knob}
      className={inputClass}
      style={inputStyle}
    />
  );
}

/**
 * The preset editor's Cut section (plan T1, B2): a base style and the knob
 * values over it. Only knobs that differ from the base are stored
 * (`style.cut`); an opt-in knob the base lacks shows "off" and is not editable
 * — choose base tight to get the onset snap, short-skip merge and fricative rule.
 */
export function PresetCutFields({ style, file, fileError, onChange }: Props) {
  if (!file) {
    return (
      <div className="text-[10px] text-text-dim" data-preset-cut>
        {fileError ? `Cut styles unavailable: ${fileError}` : 'Loading cut styles…'}
      </div>
    );
  }
  const baseName = presetCutBase(style, file);
  const base = file.styles[baseName];
  const paced = pacingToCutBase(style.pacing);
  const own = style.cut ?? {};
  const overrides = CUT_PLAN_KNOBS.filter((knob) => own[knob] !== undefined).length;
  const problems = cutSpecProblems(style.cut, base);

  return (
    <div className="flex flex-col gap-1.5" data-preset-cut>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Cut</span>
        <span className="text-[10px] text-text-dim" data-preset-cut-summary>
          {baseName}
          {overrides > 0 ? ` + ${overrides} override${overrides === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        Where Auto Cut, Transcript deletes and the editorial pass snap. Knobs left at the base&rsquo;s
        value are not stored; a project can still override the style.
      </p>
      <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
        <label className={labelClass}>
          Base
          <select
            value={own.base ?? ''}
            onChange={(e) =>
              onChange(withPresetCutBase(style, isCutPlanStyleName(e.target.value) ? e.target.value : undefined, file))
            }
            data-preset-cut-base
            className={`${inputClass} appearance-none`}
            style={inputStyle}
          >
            <option value="">{paced ? `From pacing (${paced})` : `Default (${file.default})`}</option>
            <option value="tight">Tight</option>
            <option value="natural">Natural</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
        {CUT_PLAN_KNOBS.map((knob) => {
          const info = CUT_KNOB_INFO[knob];
          const baseValue = base[knob];
          const value = own[knob];
          return (
            <label key={knob} className={labelClass}>
              <span className={value !== undefined ? 'text-accent' : undefined}>
                {info.label} ({info.unit})
              </span>
              {baseValue === undefined ? (
                <span
                  className="h-[26px] px-2 flex items-center rounded text-[11px] text-text-dim"
                  style={inputStyle}
                  data-preset-cut-off={knob}
                  title={value === undefined ? `${info.hint} Off in ${baseName}; choose base tight to use it.` : 'Set by hand in preset.json.'}
                >
                  {value === undefined ? `off (base ${baseName})` : `${formatCutKnob(knob, value)} (preset.json)`}
                </span>
              ) : (
                <KnobInput
                  key={`${baseName}-${knob}`}
                  knob={knob}
                  value={value ?? baseValue}
                  baseValue={baseValue}
                  baseName={baseName}
                  onCommit={(v) => onChange(withPresetCutKnob(style, knob, v, file))}
                />
              )}
            </label>
          );
        })}
      </div>
      {problems.length > 0 && (
        <div className="text-[10px] text-accent-amber leading-snug" data-preset-cut-problems>
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}
