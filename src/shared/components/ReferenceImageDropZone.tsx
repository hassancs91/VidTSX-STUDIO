import { useRef, useCallback } from 'react';

interface ReferenceImageDropZoneProps {
  onFiles: (files: FileList | File[]) => void;
}

/** The "drop or click to add" tile at the foot of a ReferenceImageLibrary. */
export function ReferenceImageDropZone({ onFiles }: ReferenceImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <>
      <div
        className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-3 px-3 cursor-pointer hover:border-text-dim hover:bg-app-base/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-0.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <span className="text-[10px] text-text-dim">Drop or click to add reference images</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </>
  );
}
