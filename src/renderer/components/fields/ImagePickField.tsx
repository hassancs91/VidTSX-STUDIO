import { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { GalleryImagePickerField } from './GalleryImagePickerField';

interface Props {
  label: string;
  /** An absolute file path, or an Image Studio entry id when `source` is `library`. */
  value: string;
  onChange: (next: string) => void;
  /** Which value the bound node reads (flows plan §1.4): a file path
   *  (`input_image_file.filePath`) or a gallery entry (`input_image_library.entryId`). */
  source: 'file' | 'library';
  disabled?: boolean;
}

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];

function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/**
 * The run form's `image` param (W8 Stage 2): a file chooser through the
 * native dialog — the renderer never sees bytes, the tool copies the file
 * into the run — or the gallery picker when the param binds to a library
 * entry id.
 */
export function ImagePickField({ label, value, onChange, source, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  if (source === 'library') {
    return <GalleryImagePickerField label={label} value={value} onChange={onChange} />;
  }

  const pick = async () => {
    setBusy(true);
    try {
      const res = await window.api.dialogOpen({ filters: IMAGE_FILTERS });
      if (!res.canceled && res.filePaths[0]) onChange(res.filePaths[0]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1" data-image-pick>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void pick()}
          disabled={disabled || busy}
          className="flex items-center gap-1.5 h-[26px] px-2.5 rounded-[6px] text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
          style={{ border: '0.5px solid var(--color-border-hover)' }}
        >
          <FolderOpen size={11} strokeWidth={1.75} />
          {value ? 'Change…' : 'Choose image…'}
        </button>
        {value ? (
          <>
            <span className="text-[11px] text-text-secondary truncate min-w-0 flex-1" title={value}>
              {baseName(value)}
            </span>
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              title="Clear"
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-app-hover"
            >
              <X size={11} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <span className="text-[11px] text-text-dim">No file chosen</span>
        )}
      </div>
    </div>
  );
}
