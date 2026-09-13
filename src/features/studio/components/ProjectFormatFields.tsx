import { useEffect, useState } from 'react';
import { TextInput } from '@shared/components/TextInput';
import { Select } from '@shared/components/Select';
import { coerceSttEntry, sttEntriesWithTimestamps } from '@shared/presets/stt-models';
import type { StudioProject } from '../types';
import { FORMAT_PRESETS, MAX_DIMENSION, MIN_DIMENSION, fpsOptions, parseDimension } from '../services/project-format';

interface Props {
  project: StudioProject;
  onUpdate: (updater: (prev: StudioProject) => StudioProject) => void;
}

function Label({ children }: { children: string }) {
  return <span className="text-[10px] text-text-dim">{children}</span>;
}

/**
 * Name, frame size, frame rate and speech-to-text model — the project-level
 * settings that had no surface of their own (video-10 feedback item 7).
 * Settings edits are not undoable (the brand / STT precedent). A typed size
 * commits on blur or Enter, so half-typed numbers never reach the Player.
 */
export function ProjectFormatFields({ project, onUpdate }: Props) {
  const { width, height, fps } = project.settings;
  const [widthText, setWidthText] = useState(String(width));
  const [heightText, setHeightText] = useState(String(height));
  const [sizeError, setSizeError] = useState(false);

  useEffect(() => {
    setWidthText(String(width));
    setHeightText(String(height));
  }, [width, height]);

  const setSize = (nextWidth: number, nextHeight: number) => {
    setSizeError(false);
    // Reset the fields too: a preset matching the current size must still
    // replace half-typed text (the effect below only runs on a real change).
    setWidthText(String(nextWidth));
    setHeightText(String(nextHeight));
    if (nextWidth === width && nextHeight === height) return;
    onUpdate((prev) => ({ ...prev, settings: { ...prev.settings, width: nextWidth, height: nextHeight } }));
  };

  const commitSize = () => {
    const w = parseDimension(widthText);
    const h = parseDimension(heightText);
    if (w === null || h === null) {
      setSizeError(true);
      setWidthText(String(width));
      setHeightText(String(height));
      return;
    }
    setSize(w, h);
  };

  const onSizeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitSize();
  };

  const sttId = coerceSttEntry(project.settings.sttModelId).id;
  const sttOptions = sttEntriesWithTimestamps().map((m) => ({
    value: m.id,
    label: m.provider === 'assemblyai' ? `${m.name} · best for auto-cut` : m.name,
  }));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <Label>Name</Label>
        <TextInput
          value={project.name}
          data-project-name
          onChange={(e) => {
            const name = e.target.value;
            onUpdate((prev) => ({ ...prev, name }));
          }}
        />
      </label>

      <div className="flex flex-col gap-1">
        <Label>Frame size</Label>
        <div className="flex items-center gap-1.5">
          <TextInput
            className="w-[72px]"
            value={widthText}
            inputMode="numeric"
            aria-label="Width"
            data-project-width
            onChange={(e) => setWidthText(e.target.value)}
            onBlur={commitSize}
            onKeyDown={onSizeKey}
          />
          <span className="text-[11px] text-text-dim">×</span>
          <TextInput
            className="w-[72px]"
            value={heightText}
            inputMode="numeric"
            aria-label="Height"
            data-project-height
            onChange={(e) => setHeightText(e.target.value)}
            onBlur={commitSize}
            onKeyDown={onSizeKey}
          />
          <div className="flex flex-wrap gap-1 ml-1">
            {FORMAT_PRESETS.map((preset) => {
              const active = preset.width === width && preset.height === height;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-format-preset={preset.id}
                  onClick={() => setSize(preset.width, preset.height)}
                  title={`${preset.width}×${preset.height}`}
                  className={`px-1.5 h-[22px] rounded-[5px] text-[10px] transition-colors ${
                    active ? 'bg-app-active text-text-primary' : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
                  }`}
                  style={{ border: '0.5px solid var(--color-border)' }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
        <span className={`text-[10px] leading-snug ${sizeError ? 'text-accent-red' : 'text-text-dim'}`}>
          {sizeError
            ? `Use whole numbers from ${MIN_DIMENSION} to ${MAX_DIMENSION}; odd sizes round up to even.`
            : 'The composition size for preview and export. Shots render at this size.'}
        </span>
      </div>

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <label className="flex flex-col gap-1">
          <Label>Frame rate</Label>
          <Select
            value={String(fps)}
            onChange={(v) =>
              onUpdate((prev) => ({ ...prev, settings: { ...prev.settings, fps: Number(v) } }))
            }
            options={fpsOptions(fps)}
          />
        </label>
        <label className="flex flex-col gap-1 min-w-0" data-project-stt>
          <Label>Speech-to-text model</Label>
          <Select
            value={sttId}
            onChange={(sttModelId) =>
              onUpdate((prev) => ({ ...prev, settings: { ...prev.settings, sttModelId } }))
            }
            options={sttOptions}
          />
        </label>
      </div>
    </div>
  );
}
