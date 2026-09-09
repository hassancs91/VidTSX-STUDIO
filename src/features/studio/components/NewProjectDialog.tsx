import { useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { TextInput } from '@shared/components/TextInput';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import type { StudioProjectCreateRequest } from '@shared/ipc/types';
import { usePresetList } from '../hooks/usePresetList';

interface FormatPreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'landscape', label: 'Landscape', description: 'YouTube · 16:9 · 1920×1080', width: 1920, height: 1080 },
  { id: 'portrait', label: 'Portrait', description: 'Shorts / Reels · 9:16 · 1080×1920', width: 1080, height: 1920 },
  { id: 'square', label: 'Square', description: '1:1 · 1080×1080', width: 1080, height: 1080 },
];

const FPS_OPTIONS = ['24', '25', '30', '50', '60'].map((v) => ({ value: v, label: `${v} fps` }));

/** A preset's orientation → the format tile it implies (W5). */
const ORIENTATION_FORMAT: Record<string, string> = { '16:9': 'landscape', '9:16': 'portrait', '1:1': 'square' };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (req: StudioProjectCreateRequest) => Promise<void>;
}

export function NewProjectDialog({ isOpen, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [formatId, setFormatId] = useState('landscape');
  const [fps, setFps] = useState('30');
  const [presetId, setPresetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const presets = usePresetList();

  const reset = () => {
    setName('');
    setFormatId('landscape');
    setFps('30');
    setPresetId('');
    setSubmitting(false);
  };

  // Picking a preset that knows its orientation also picks the matching
  // format tile — the user can still change it afterwards.
  const choosePreset = (id: string) => {
    setPresetId(id);
    const orientation = presets.find((p) => p.id === id)?.orientation;
    const format = orientation ? ORIENTATION_FORMAT[orientation] : undefined;
    if (format) setFormatId(format);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const format = FORMAT_PRESETS.find((f) => f.id === formatId);
    if (!trimmed || !format || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: trimmed,
        width: format.width,
        height: format.height,
        fps: Number(fps),
        ...(presetId ? { presetId } : {}),
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Studio Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-[460px]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Project"
            autoFocus
            required
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Format</span>
          <div className="grid grid-cols-3 gap-2">
            {FORMAT_PRESETS.map((format) => (
              <FormatTile
                key={format.id}
                format={format}
                isSelected={formatId === format.id}
                onSelect={() => setFormatId(format.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 w-[140px]">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Frame rate</span>
            <Select value={fps} onChange={setFps} options={FPS_OPTIONS} />
          </label>
          {presets.length > 0 && (
            <label className="flex flex-col gap-1 flex-1 min-w-0" data-new-project-preset>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Editing preset</span>
              <Select
                value={presetId}
                onChange={choosePreset}
                options={[
                  { value: '', label: 'No preset' },
                  ...presets.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <span className="text-[10px] text-text-dim leading-snug">
                {presets.find((p) => p.id === presetId)?.description ??
                  'The playbook the assistant follows for a full edit. Manage presets on the Assets screen.'}
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormatTile({
  format,
  isSelected,
  onSelect,
}: {
  format: FormatPreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isPortrait = format.height > format.width;
  const isSquare = format.height === format.width;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col items-center gap-1.5 p-2 rounded-md transition-colors',
        isSelected ? 'bg-accent/10 ring-1 ring-accent' : 'bg-app-deep hover:bg-app-hover',
      ].join(' ')}
      style={{ border: isSelected ? '0.5px solid transparent' : '0.5px solid var(--color-border)' }}
    >
      <div className="h-[56px] flex items-center justify-center">
        <div
          className={`rounded-[3px] bg-app-surface ${isSelected ? 'ring-1 ring-accent/60' : ''}`}
          style={{
            border: '0.5px solid var(--color-border-hover)',
            width: isPortrait ? 28 : isSquare ? 44 : 72,
            height: isPortrait ? 50 : isSquare ? 44 : 40,
          }}
        />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-medium text-text-primary">{format.label}</div>
        <div className="text-[10px] text-text-muted leading-snug">{format.description}</div>
      </div>
    </button>
  );
}
