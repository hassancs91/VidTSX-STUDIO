import type { GalleryImage } from '../types';

const DownloadIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const TrashIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const UseAsInputIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

function ActionButton({ onClick, children, title }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode; title: string }) {
  return (
    <button
      className="flex items-center justify-center w-[28px] h-[28px] rounded-md bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

const MoveOutIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
    <path d="M15 12H3" />
    <path d="M21 3v18" />
  </svg>
);

const CheckIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface ImageCardProps {
  image: GalleryImage;
  onView: (image: GalleryImage) => void;
  onSaveAs: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onUseAsInput: (image: GalleryImage) => void;
  onMoveToRoot?: (id: string) => void;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, additive: boolean) => void;
}

export function ImageCard({
  image,
  onView,
  onSaveAs,
  onCopy,
  onDelete,
  onUseAsInput,
  onMoveToRoot,
  selected = false,
  selectionMode = false,
  onToggleSelect,
}: ImageCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/image-id', image.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(image.id, e.shiftKey);
      return;
    }
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && onToggleSelect) {
      onToggleSelect(image.id, e.shiftKey);
      return;
    }
    onView(image);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) onToggleSelect(image.id, e.shiftKey);
  };

  const showCheckbox = selectionMode || selected;

  return (
    <div
      className={`relative rounded-lg overflow-hidden cursor-pointer group ${
        selected ? 'ring-2 ring-accent ring-offset-0' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleCardClick}
    >
      <img
        src={image.thumbnailUrl}
        alt={image.prompt}
        className={`w-full block transition-opacity ${selected ? 'opacity-80' : ''}`}
        loading="lazy"
        decoding="async"
        width={image.width ?? undefined}
        height={image.height ?? undefined}
      />

      {/* Selection checkbox — top-left, always visible in selection mode, on hover otherwise.
          z-20 keeps it above the hover overlay so clicks reliably land on the circle. */}
      <button
        type="button"
        onClick={handleCheckboxClick}
        title={selected ? 'Deselect' : 'Select'}
        className={`absolute top-2 left-2 z-20 w-[20px] h-[20px] rounded-full flex items-center justify-center transition-all ${
          selected
            ? 'bg-accent text-white opacity-100'
            : 'bg-black/50 border border-white/40 text-transparent hover:bg-black/70'
        } ${showCheckbox ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        {selected && <CheckIcon />}
      </button>

      {/* Hover overlay. pointer-events-none on the container so empty space doesn't
          intercept clicks meant for the check circle (or bubble up to open the lightbox);
          the action button row re-enables pointer events for itself. */}
      <div
        className={`absolute inset-0 bg-black/40 flex flex-col justify-end p-2 gap-1.5 pointer-events-none transition-opacity ${
          selectionMode ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
          {/* Action buttons — bottom-right, above the prompt info */}
          <div className="flex justify-end gap-1 flex-wrap pointer-events-auto">
            <ActionButton title="Use as Input" onClick={(e) => { e.stopPropagation(); onUseAsInput(image); }}>
              <UseAsInputIcon />
            </ActionButton>
            <ActionButton title="Save As" onClick={(e) => { e.stopPropagation(); onSaveAs(image.id); }}>
              <DownloadIcon />
            </ActionButton>
            <ActionButton title="Copy" onClick={(e) => { e.stopPropagation(); onCopy(image.id); }}>
              <CopyIcon />
            </ActionButton>
            {onMoveToRoot && (
              <ActionButton title="Move to Root" onClick={(e) => { e.stopPropagation(); onMoveToRoot(image.id); }}>
                <MoveOutIcon />
              </ActionButton>
            )}
            <ActionButton title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}>
              <TrashIcon />
            </ActionButton>
          </div>

          {/* Bottom info */}
          <div className="pointer-events-none">
            <div className="text-[10px] text-white/70 truncate">{image.prompt}</div>
            <div className="text-[9px] text-white/50">{image.model} · {image.width != null && image.height != null ? `${image.width}×${image.height}` : 'Unknown size'}</div>
          </div>
        </div>
    </div>
  );
}
