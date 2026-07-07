import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { downscaleImage } from '../../services/downscale-image';

interface UploadValue {
  base64: string;
  fileName: string;
  width: number;
  height: number;
  contentType: string;
}

interface Props {
  label: string;
  value: UploadValue;
  onChange: (next: UploadValue) => void;
}

export function ImageUploadField({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const result = await downscaleImage(file);
      onChange({
        base64: result.base64,
        fileName: file.name,
        width: result.width,
        height: result.height,
        contentType: result.contentType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    onChange({ base64: '', fileName: '', width: 0, height: 0, contentType: 'image/jpeg' });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>

      {value.base64 ? (
        <div
          className="relative rounded-md overflow-hidden bg-app-deep flex items-center justify-center"
          style={{ height: 140, border: '0.5px solid var(--color-border)' }}
        >
          <img
            src={`data:${value.contentType};base64,${value.base64}`}
            alt={value.fileName}
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute top-1 right-1 p-1 rounded bg-app-deep/80 text-text-muted hover:text-accent-red"
            title="Remove image"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
          <span
            className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-app-deep/80 text-[9px] text-text-dim"
          >
            {value.width}×{value.height}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={busy}
          className="flex flex-col items-center justify-center gap-1.5 rounded-md bg-app-deep hover:bg-app-hover transition-colors disabled:opacity-50"
          style={{ height: 100, border: '0.5px dashed var(--color-border)' }}
        >
          <Upload size={18} strokeWidth={1.4} className="text-text-muted" />
          <span className="text-[11px] text-text-muted">
            {busy ? 'Processing…' : 'Click to upload'}
          </span>
        </button>
      )}

      {error && <span className="text-[11px] text-accent-red">{error}</span>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
