import { useCallback, useRef } from 'react';
import type { LlmImageIpc } from '@shared/ipc/types';

const MAX_IMAGES = 3;

type AllowedMediaType = LlmImageIpc['mediaType'];

const ALLOWED_MEDIA_TYPES: AllowedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function toAllowedMediaType(fileType: string): AllowedMediaType | null {
  const normalized = fileType.toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  return (ALLOWED_MEDIA_TYPES as string[]).includes(normalized) ? (normalized as AllowedMediaType) : null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  images: LlmImageIpc[];
  onChange: (images: LlmImageIpc[]) => void;
  disabled?: boolean;
}

export function ReferenceImagePicker({ images, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_IMAGES - images.length;
  const canAdd = remaining > 0 && !disabled;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const accepted: LlmImageIpc[] = [];
    for (const file of Array.from(files)) {
      if (accepted.length + images.length >= MAX_IMAGES) break;
      const mediaType = toAllowedMediaType(file.type);
      if (!mediaType) continue;
      const data = await readFileAsBase64(file);
      accepted.push({ data, mediaType });
    }
    if (accepted.length > 0) {
      onChange([...images, ...accepted].slice(0, MAX_IMAGES));
    }
  }, [images, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canAdd) return;
    addFiles(e.dataTransfer.files);
  }, [addFiles, canAdd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClick = () => {
    if (canAdd) inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeAt = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="text-[10px] text-text-dim mb-1">
        Reference Images <span className="text-text-dim">({images.length}/{MAX_IMAGES})</span>
      </div>

      {images.length > 0 && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Reference ${i + 1}`}
                className="w-[52px] h-[52px] object-cover rounded border border-border"
              />
              <button
                type="button"
                disabled={disabled}
                className="absolute -top-1 -right-1 w-[16px] h-[16px] rounded-full bg-accent-red text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                onClick={() => removeAt(i)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div
          className="flex flex-col items-center justify-center rounded-lg py-3 px-3 cursor-pointer hover:bg-app-base/50 transition-colors"
          style={{ border: '1px dashed var(--color-border-hover)' }}
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-0.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-[10px] text-text-dim">
            Drop or click to add {images.length === 0 ? 'up to 3 images' : `${remaining} more`}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
