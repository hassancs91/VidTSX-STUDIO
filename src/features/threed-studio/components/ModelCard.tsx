import type { GalleryModel } from '../types';

const CubeIcon = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const LibraryIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const TrashIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

export function formatSeconds(s: number | null): string {
  if (s == null) return '';
  return s >= 100 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}

interface ModelCardProps {
  model: GalleryModel;
  onView: (model: GalleryModel) => void;
  onSaveAs: (id: string) => void;
  onSaveToLibrary: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Gallery tile: the runner's NeRF view-0 render as the thumbnail (plan §5 step 3). */
export function ModelCard({ model, onView, onSaveAs, onSaveToLibrary, onDelete }: ModelCardProps) {
  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer group bg-app-deep"
      style={{ aspectRatio: '1 / 1' }}
      onClick={() => onView(model)}
      data-testid="model-card"
    >
      {model.previewUrl ? (
        <img src={model.previewUrl} alt={model.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-dim/50">
          <CubeIcon />
        </div>
      )}
      {model.inputUrl && (
        <img src={model.inputUrl} alt="" className="absolute bottom-1 left-1 w-[40px] h-[40px] object-cover rounded border border-white/20 bg-black/40" loading="lazy" decoding="async" title="Input image" />
      )}
      <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2 gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex justify-end gap-1 flex-wrap pointer-events-auto">
          <ActionButton title="Save to asset library" onClick={(e) => { e.stopPropagation(); onSaveToLibrary(model.id); }}>
            <LibraryIcon />
          </ActionButton>
          <ActionButton title="Save As (.glb)" onClick={(e) => { e.stopPropagation(); onSaveAs(model.id); }}>
            <DownloadIcon />
          </ActionButton>
          <ActionButton title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(model.id); }}>
            <TrashIcon />
          </ActionButton>
        </div>
        <div className="pointer-events-none">
          <div className="text-[10px] text-white/70 truncate">{model.name}</div>
          <div className="text-[9px] text-white/50">
            {model.quality}³ · {model.vertices != null ? `${(model.vertices / 1000).toFixed(0)}k verts` : ''} · {formatSeconds(model.seconds)} {model.device?.startsWith('cuda') ? 'GPU' : model.device ? 'CPU' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
