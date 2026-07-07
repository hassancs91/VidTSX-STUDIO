import { useState, useRef, useEffect } from 'react';

interface InlineRenameInputProps {
  initialName: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export function InlineRenameInput({
  initialName,
  onSave,
  onCancel,
}: InlineRenameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select the filename without extension
    const input = inputRef.current;
    if (input) {
      input.focus();
      const dotIndex = initialName.lastIndexOf('.');
      if (dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
      } else {
        input.select();
      }
    }
  }, [initialName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== initialName) {
        onSave(trimmed);
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="bg-app-surface border border-accent rounded px-1 py-[2px] text-[12px] text-text-primary outline-none focus:border-accent-light w-full"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
