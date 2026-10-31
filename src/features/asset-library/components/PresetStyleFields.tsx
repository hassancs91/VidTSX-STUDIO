import type { StudioPresetStyle } from '@shared/types/studio-preset';

const inputClass =
  'h-[26px] px-2 rounded bg-app-base text-text-primary text-[11px] focus:outline-none w-full';
const selectClass = `${inputClass} appearance-none`;
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;

const numberOrUndefined = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));

/** The preset's structured style knobs (pacing, shots/SFX per minute, music,
 *  captions, intro/outro, transitions) — split out of PresetForm (B2). The
 *  cut style has its own section, PresetCutFields. */
export function PresetStyleFields({
  style,
  onChange,
}: {
  style: StudioPresetStyle;
  onChange: (patch: Partial<StudioPresetStyle>) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Pacing
        <select
          value={style.pacing ?? ''}
          onChange={(e) => onChange({ pacing: (e.target.value || undefined) as StudioPresetStyle['pacing'] })}
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
        <input type="number" min={0} max={30} step={0.5} value={style.shotsPerMinute ?? ''} onChange={(e) => onChange({ shotsPerMinute: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        SFX / min
        <input type="number" min={0} max={60} step={0.5} value={style.sfxPerMinute ?? ''} onChange={(e) => onChange({ sfxPerMinute: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Music bed
        <select value={style.musicBed ?? ''} onChange={(e) => onChange({ musicBed: (e.target.value || undefined) as StudioPresetStyle['musicBed'] })} className={selectClass} style={inputStyle}>
          <option value="">—</option>
          <option value="none">None</option>
          <option value="quiet">Quiet</option>
          <option value="present">Present</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Captions
        <select value={style.captions ?? ''} onChange={(e) => onChange({ captions: (e.target.value || undefined) as StudioPresetStyle['captions'] })} className={selectClass} style={inputStyle}>
          <option value="">—</option>
          <option value="none">None</option>
          <option value="karaoke">Karaoke</option>
          <option value="block">Block</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Intro (s)
        <input type="number" min={0} max={120} value={style.introSeconds ?? ''} onChange={(e) => onChange({ introSeconds: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Outro (s)
        <input type="number" min={0} max={120} value={style.outroSeconds ?? ''} onChange={(e) => onChange({ outroSeconds: numberOrUndefined(e.target.value) })} className={inputClass} style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Transitions
        <input
          value={(style.transitions ?? []).join(', ')}
          onChange={(e) => onChange({ transitions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          placeholder="crossfade"
          className={inputClass}
          style={inputStyle}
        />
      </label>
    </div>
  );
}
