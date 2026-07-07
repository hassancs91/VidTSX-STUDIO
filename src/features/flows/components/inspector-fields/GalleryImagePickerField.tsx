import { useEffect, useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Select } from '@shared/components/Select';
import type { ImageStudioEntry, ImageStudioFolder } from '@shared/ipc/types';

interface Props {
  label: string;
  value: string;
  onChange: (entryId: string) => void;
}

interface State {
  status: 'loading' | 'ready' | 'error';
  entries: ImageStudioEntry[];
  folders: ImageStudioFolder[];
  basePath: string;
  error: string | null;
}

function thumbUrl(basePath: string, fileName: string): string {
  const normalized = basePath.replace(/\\/g, '/');
  return `file:///${normalized}/${fileName}`;
}

export function GalleryImagePickerField({ label, value, onChange }: Props) {
  const [state, setState] = useState<State>({
    status: 'loading',
    entries: [],
    folders: [],
    basePath: '',
    error: null,
  });
  const [folderFilter, setFolderFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void window.api.imageStudioList().then((res) => {
      if (cancelled) return;
      if (res.success) {
        setState({
          status: 'ready',
          entries: res.entries,
          folders: res.folders,
          basePath: res.basePath,
          error: null,
        });
      } else {
        setState({
          status: 'error',
          entries: [],
          folders: [],
          basePath: '',
          error: res.error ?? 'Failed to load gallery',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!folderFilter) return state.entries;
    return state.entries.filter((e) => (e.folderId ?? '') === folderFilter);
  }, [state.entries, folderFilter]);

  const selected = state.entries.find((e) => e.id === value);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>

      {selected && (
        <div
          className="relative rounded-md overflow-hidden bg-app-deep flex items-center justify-center"
          style={{ height: 100, border: '0.5px solid var(--color-border)' }}
        >
          <img
            src={thumbUrl(state.basePath, selected.fileName)}
            alt={selected.prompt || selected.fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {state.folders.length > 0 && (
        <Select
          value={folderFilter}
          onChange={setFolderFilter}
          options={[
            { value: '', label: 'All folders' },
            ...state.folders.map((f) => ({ value: f.id, label: f.name })),
          ]}
        />
      )}

      <div
        className="rounded-md bg-app-deep p-1 grid grid-cols-3 gap-1 overflow-y-auto"
        style={{ maxHeight: 220, border: '0.5px solid var(--color-border)' }}
      >
        {state.status === 'loading' && (
          <div className="col-span-3 flex items-center justify-center h-20 text-[11px] text-text-dim">
            Loading…
          </div>
        )}
        {state.status === 'ready' && filtered.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center gap-1 h-20 text-[11px] text-text-dim">
            <ImageIcon size={20} strokeWidth={1.2} />
            <span>No images</span>
          </div>
        )}
        {state.status === 'error' && (
          <div className="col-span-3 text-[11px] text-accent-red p-2">{state.error}</div>
        )}
        {filtered.map((entry) => {
          const isSelected = entry.id === value;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry.id)}
              title={entry.prompt || entry.fileName}
              className={`
                relative aspect-square rounded overflow-hidden bg-app-base
                hover:ring-1 hover:ring-accent transition-all
                ${isSelected ? 'ring-2 ring-accent' : ''}
              `}
            >
              <img
                src={thumbUrl(state.basePath, entry.fileName)}
                alt={entry.prompt || entry.fileName}
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
