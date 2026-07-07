import { useRef, useCallback } from 'react';

interface ImageInputProps {
  mode: 'single' | 'multi';
  images: string[];
  onAdd: (base64Images: string[]) => void;
  onRemove: (index: number) => void;
  maxImages?: number;
  label?: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URI prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageInput({ mode, images, onAdd, onRemove, maxImages = 10, label }: ImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const base64Images: string[] = [];
    for (const file of imageFiles) {
      base64Images.push(await readFileAsBase64(file));
    }

    if (mode === 'single') {
      onAdd(base64Images.slice(0, 1));
    } else {
      const remaining = maxImages - images.length;
      onAdd(base64Images.slice(0, remaining));
    }
  }, [mode, images.length, maxImages, onAdd]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const canAdd = mode === 'single' || images.length < maxImages;

  return (
    <div>
      {label && <div className="text-[10px] text-text-dim mb-1">{label}</div>}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {images.map((base64, idx) => (
            <div key={idx} className="relative group">
              <img
                src={`data:image/png;base64,${base64}`}
                alt={`Input ${idx + 1}`}
                className="w-[52px] h-[52px] object-cover rounded border border-border"
              />
              <button
                type="button"
                className="absolute -top-1 -right-1 w-[16px] h-[16px] rounded-full bg-accent-red text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(idx)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAdd && (
        <div
          className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-4 px-3 cursor-pointer hover:border-text-dim hover:bg-app-base/50 transition-colors"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-[10px] text-text-dim">
            {mode === 'single' ? 'Drop image or click to upload' : `Add images (${images.length}/${maxImages})`}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={mode === 'multi'}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
