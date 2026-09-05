import { useEffect, useState } from 'react';
import { Button, Modal } from '@shared/components';
import type { ImageStudioEntry } from '../../../shared/ipc/types';

export interface PickedImage {
  id: string;
  fileName: string;
  prompt: string;
  url: string;
}

interface ImageStudioPickerDialogProps {
  onPick: (image: PickedImage) => void;
  onCancel: () => void;
}

/** "From Image Studio": pick a gallery image as the 3D input (goes through the Image Studio list IPC). */
export function ImageStudioPickerDialog({ onPick, onCancel }: ImageStudioPickerDialogProps) {
  const [images, setImages] = useState<PickedImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    void window.api.imageStudioList().then((res) => {
      if (!alive) return;
      if (!res.success) { setError(res.error ?? 'Could not list Image Studio'); return; }
      const base = res.basePath.replace(/\\/g, '/');
      setImages(res.entries.map((e: ImageStudioEntry) => ({ id: e.id, fileName: e.fileName, prompt: e.prompt, url: `file:///${base}/${e.fileName}` })));
    });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = images?.filter((i) => !q || i.prompt.toLowerCase().includes(q) || i.fileName.toLowerCase().includes(q)) ?? [];

  return (
    <Modal isOpen onClose={onCancel} title="Pick an image from Image Studio">
      <div className="p-3 w-[560px] max-w-[90vw]">
        <input
          type="text"
          placeholder="Search prompts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-[26px] w-full px-2 mb-2 rounded text-[11px] bg-app-base border border-border text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
        />
        {error && <div className="text-[11px] text-accent-red">{error}</div>}
        {!images && !error && <div className="text-[11px] text-text-dim p-3 text-center">Loading…</div>}
        {images && shown.length === 0 && <div className="text-[11px] text-text-dim p-3 text-center">No images{q ? ' match' : ' in Image Studio yet'}</div>}
        <div className="max-h-[50vh] overflow-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
          {shown.map((img) => (
            <button key={img.id} type="button" onClick={() => onPick(img)} className="rounded overflow-hidden border border-border hover:border-accent bg-app-deep" title={img.prompt} style={{ aspectRatio: '1 / 1' }}>
              <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
