import { useState, useEffect, useRef } from 'react';

interface InlineRenameInputProps {
  initialValue: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export function InlineRenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: InlineRenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim();
      if (trimmed && trimmed !== initialValue) {
        onConfirm(trimmed);
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="bg-app-base text-text-primary rounded-[4px] px-1 py-0.5 text-[10px] outline-none w-full"
      style={{ border: '0.5px solid var(--color-accent)' }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      autoFocus
    />
  );
}
