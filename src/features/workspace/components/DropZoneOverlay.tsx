interface DropZoneOverlayProps {
  visible: boolean;
}

export function DropZoneOverlay({ visible }: DropZoneOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/10 backdrop-blur-sm">
      <div className="border-2 border-dashed border-accent rounded-lg p-8">
        <p className="text-accent text-lg font-medium">Drop TSX files here</p>
      </div>
    </div>
  );
}
