import { useState, useEffect, useRef } from "react";
import { Modal, Button, TextInput } from "@shared/components";

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function NewFolderModal({ isOpen, onClose, onCreate }: NewFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCreate = () => {
    const trimmed = folderName.trim();
    if (trimmed) {
      onCreate(trimmed);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Folder">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-text-muted">Folder name</label>
          <TextInput
            ref={inputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter folder name"
            size="md"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!folderName.trim()}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
