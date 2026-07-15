import { useState } from 'react';
import { Button } from '@shared/components';

const FAMILIES: { id: string; label: string; note: string }[] = [
  { id: 'sd15', label: 'SD 1.5', note: '512px · 20 steps · euler_a' },
  { id: 'sdxl', label: 'SDXL', note: '1024px · 25 steps · euler' },
  { id: 'sd3', label: 'SD 3.x', note: '1024px · 28 steps · euler' },
  { id: 'flux1', label: 'FLUX.1', note: 'needs clip_l + t5xxl + VAE' },
  { id: 'flux2', label: 'FLUX.2', note: 'needs LLM encoder + VAE' },
];

export interface ModelSetupResult {
  family: string;
  name?: string;
  allInOne: boolean;
  mode: 'move' | 'copy';
}

interface ModelSetupDialogProps {
  fileName: string;
  /** Show the Move/Copy choice (import flow). Configure flow omits it. */
  showImportMode?: boolean;
  initialFamily?: string;
  onConfirm: (result: ModelSetupResult) => void;
  onCancel: () => void;
}

export function ModelSetupDialog({
  fileName,
  showImportMode = false,
  initialFamily = 'sd15',
  onConfirm,
  onCancel,
}: ModelSetupDialogProps) {
  const [family, setFamily] = useState(initialFamily);
  const [name, setName] = useState('');
  const [allInOne, setAllInOne] = useState(false);
  const [mode, setMode] = useState<'move' | 'copy'>('move');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-[420px] max-w-[90vw] bg-app-surface rounded-lg border border-border p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[13px] font-medium text-text-primary mb-1">Set up model</h3>
        <p className="text-[11px] text-text-dim font-mono truncate mb-3" title={fileName}>{fileName}</p>

        {showImportMode && (
          <div className="mb-3">
            <div className="text-[11px] text-text-muted mb-1.5">Import method</div>
            <div className="flex gap-2">
              {(['move', 'copy'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 px-2 h-[30px] rounded text-[11px] font-medium border transition-colors ${
                    mode === m
                      ? 'border-accent bg-accent/10 text-accent-light'
                      : 'border-border text-text-muted hover:bg-app-hover'
                  }`}
                >
                  {m === 'move' ? 'Move (recommended)' : 'Copy'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="text-[11px] text-text-muted mb-1.5">Model family (applies matching defaults)</div>
          <div className="grid grid-cols-1 gap-1">
            {FAMILIES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFamily(f.id)}
                className={`flex items-center justify-between px-2.5 h-[32px] rounded text-[11px] border transition-colors ${
                  family === f.id
                    ? 'border-accent bg-accent/10 text-accent-light'
                    : 'border-border text-text-secondary hover:bg-app-hover'
                }`}
              >
                <span className="font-medium">{f.label}</span>
                <span className="text-[10px] text-text-dim">{f.note}</span>
              </button>
            ))}
          </div>
        </div>

        {family === 'flux1' && (
          <label className="flex items-start gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allInOne}
              onChange={(e) => setAllInOne(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[11px] text-text-secondary">
              All-in-one checkpoint (includes text encoders &amp; VAE)
              <span className="block text-[10px] text-text-dim">
                Common for Civitai FLUX.1 files. Skips companion files and uses <code>-m</code>.
              </span>
            </span>
          </label>
        )}

        <div className="mb-4">
          <div className="text-[11px] text-text-muted mb-1.5">Display name (optional)</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={fileName}
            className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[12px] text-text-secondary placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              onConfirm({ family, name: name.trim() || undefined, allInOne: family === 'flux1' && allInOne, mode })
            }
          >
            {showImportMode ? 'Import' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
