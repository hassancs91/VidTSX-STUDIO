import { Button, Modal } from '@shared/components';

interface DeleteModelDialogProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteModelDialog({ name, onConfirm, onCancel }: DeleteModelDialogProps) {
  return (
    <Modal isOpen onClose={onCancel} title="Delete 3D model">
      <div className="p-4 max-w-[400px] space-y-3">
        <p className="text-[12px] text-text-secondary">
          Delete <span className="text-text-primary">{name}</span>? The mesh, its preview and input image are removed from disk. Copies saved to the asset library stay.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </Modal>
  );
}
