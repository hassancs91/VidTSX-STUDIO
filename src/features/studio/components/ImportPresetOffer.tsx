import type { StudioPackagePresetChoice } from '@shared/ipc/types';

/**
 * The import dialog's preset offer (W5, the Q7f brand-offer shape): the
 * package carries an editing preset by snapshot; the far side matches one of
 * its own, creates this one, or imports without.
 */
export function ImportPresetOffer({
  presetName,
  presets,
  mode,
  matchPresetId,
  onMode,
  onMatch,
}: {
  presetName: string;
  presets: Array<{ id: string; name: string }>;
  mode: StudioPackagePresetChoice['mode'];
  matchPresetId: string;
  onMode: (mode: StudioPackagePresetChoice['mode']) => void;
  onMatch: (presetId: string) => void;
}) {
  const options: Array<{ mode: StudioPackagePresetChoice['mode']; label: string; hint: string }> = [
    {
      mode: 'match',
      label: 'Use one of my presets',
      hint: 'The assistant follows a preset already in your library.',
    },
    {
      mode: 'create',
      label: 'Create this preset',
      hint: 'Adds its workflow, knobs and PRESET.md to your library, available to every project.',
    },
    { mode: 'none', label: 'No preset', hint: 'The assistant follows the generic workflow.' },
  ];

  return (
    <div className="flex flex-col gap-1.5" data-import-preset-offer>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">
        Editing preset — the package carries “{presetName}”
      </span>
      <div className="flex flex-col gap-1">
        {options.map((option) => (
          <label
            key={option.mode}
            className="flex items-start gap-2 cursor-pointer"
            data-import-preset-option={option.mode}
          >
            <input
              type="radio"
              name="import-preset"
              checked={mode === option.mode}
              onChange={() => onMode(option.mode)}
              disabled={option.mode === 'match' && presets.length === 0}
              className="mt-[3px]"
            />
            <span className="text-[11px] text-text-secondary">
              {option.label}
              <span className="block text-[10px] text-text-dim">{option.hint}</span>
            </span>
          </label>
        ))}
        {mode === 'match' && presets.length > 0 && (
          <select
            value={matchPresetId}
            onChange={(e) => onMatch(e.target.value)}
            data-import-preset-match
            className="ml-5 h-[26px] px-2 rounded bg-app-base text-text-primary text-[11px] focus:outline-none"
            style={{ border: '0.5px solid var(--color-border-input)' }}
          >
            <option value="">Choose a preset…</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
