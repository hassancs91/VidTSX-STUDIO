import { useMemo, useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { Modal } from '@shared/components/Modal';
import { TextInput } from '@shared/components/TextInput';
import { Button } from '@shared/components/Button';
import type { FlowProjectCreateRequest } from '@shared/ipc/types';
import { FLOW_TEMPLATES, getTemplate, type TemplateDef } from '../templates';
import { renderGraphThumbnail } from '../services/render-graph-thumbnail';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (req: FlowProjectCreateRequest) => Promise<void>;
}

const BLANK_TILE_ID = '__blank__';
const TILE_W = 240;
const TILE_H = 100;

export function NewFlowDialog({ isOpen, onClose, onCreate }: Props) {
  const [selectedId, setSelectedId] = useState<string>(BLANK_TILE_ID);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedId(BLANK_TILE_ID);
    setName('');
    setDescription('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const template = selectedId === BLANK_TILE_ID ? null : getTemplate(selectedId);
      await onCreate({
        name: trimmed,
        description: description.trim() || undefined,
        graphJson: template ? JSON.stringify(template.graph) : undefined,
        source: template ? 'template' : 'user',
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Flow">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-[560px]">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Start from</span>
          <div className="grid grid-cols-2 gap-2">
            <BlankTile
              isSelected={selectedId === BLANK_TILE_ID}
              onSelect={() => setSelectedId(BLANK_TILE_ID)}
            />
            {FLOW_TEMPLATES.map((t) => (
              <TemplateTile
                key={t.id}
                template={t}
                isSelected={selectedId === t.id}
                onSelect={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Name</span>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled Flow"
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Description (optional)
            </span>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this flow for?"
            />
          </label>
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

function tileClass(isSelected: boolean): string {
  return [
    'flex flex-col gap-1.5 p-2 rounded-md text-left transition-colors',
    isSelected ? 'bg-accent/10 ring-1 ring-accent' : 'bg-app-deep hover:bg-app-hover',
  ].join(' ');
}

function tileBorderStyle(isSelected: boolean): React.CSSProperties {
  return {
    border: isSelected ? '0.5px solid transparent' : '0.5px solid var(--color-border)',
  };
}

interface BlankTileProps {
  isSelected: boolean;
  onSelect: () => void;
}

function BlankTile({ isSelected, onSelect }: BlankTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={tileClass(isSelected)}
      style={tileBorderStyle(isSelected)}
    >
      <div
        className="rounded bg-app-surface flex items-center justify-center"
        style={{ height: TILE_H, border: '0.5px solid var(--color-border)' }}
      >
        <FilePlus2 size={28} strokeWidth={1.2} className="text-text-dim" />
      </div>
      <div className="px-1 pt-1 pb-0.5">
        <div className="text-[12px] font-medium text-text-primary">Blank</div>
        <div className="text-[11px] text-text-muted leading-snug">Start with an empty canvas.</div>
      </div>
    </button>
  );
}

interface TemplateTileProps {
  template: TemplateDef;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateTile({ template, isSelected, onSelect }: TemplateTileProps) {
  const thumb = useMemo(
    () => renderGraphThumbnail(template.graph, { width: TILE_W, height: TILE_H }),
    [template.graph],
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      className={tileClass(isSelected)}
      style={tileBorderStyle(isSelected)}
    >
      <div
        className="rounded overflow-hidden"
        style={{ height: TILE_H, border: '0.5px solid var(--color-border)' }}
      >
        <img src={thumb} alt={template.name} className="w-full h-full object-cover" />
      </div>
      <div className="px-1 pt-1 pb-0.5">
        <div className="text-[12px] font-medium text-text-primary">{template.name}</div>
        <div className="text-[11px] text-text-muted leading-snug">{template.description}</div>
      </div>
    </button>
  );
}
