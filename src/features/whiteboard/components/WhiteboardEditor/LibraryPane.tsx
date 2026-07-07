import type { Asset, DrawableAsset, ImageAsset, LibraryAsset, TextAsset, UserImageAsset, UserSvgAsset } from '../../types';
import { LIBRARY_ASSETS } from '../../services/asset-catalog';
import { WhiteboardLibraryPanel } from '../WhiteboardLibraryPanel';
import { AssetInspectorPanel } from '../AssetInspectorPanel';

interface LibraryPaneProps {
  collapsed: boolean;
  onToggleCollapsed: (next: boolean) => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  selectedAsset: Asset | null;
  sceneAssets: Asset[];
  userSvgs: UserSvgAsset[];
  userImages: UserImageAsset[];
  onAdd: (asset: LibraryAsset) => void;
  onAddImage: (img: UserImageAsset) => void;
  onUploadSvg: (file: File) => Promise<void>;
  onUploadImage: (file: File) => Promise<void>;
  onRemoveUserSvg: (id: string) => void;
  onRemoveUserImage: (id: string) => void;
  onRemove: (index: number) => void;
  /** Phase 12 — opens the vectorize modal for the chosen user image. */
  onVectorizeImage?: (img: UserImageAsset) => void;
  /** Phase 12 — opens the vectorize modal for the currently selected image
   *  asset (inspector entry point). */
  onVectorizeSelectedImage?: () => void;
  onUpdateSelected: (patch: Partial<DrawableAsset> | Partial<ImageAsset> | Partial<TextAsset>) => void;
  onDeleteSelected: () => void;
  onCloseInspector: () => void;
  onReplaceSelectedImage: (file: File) => Promise<void>;
  /** Phase 11.b — fed to the Inspector's draw-mode duration hint. */
  scenePxPerSec?: number;
}

export function LibraryPane({
  collapsed,
  onToggleCollapsed,
  width,
  onResizeStart,
  selectedAsset,
  sceneAssets,
  userSvgs,
  userImages,
  onAdd,
  onAddImage,
  onUploadSvg,
  onUploadImage,
  onRemoveUserSvg,
  onRemoveUserImage,
  onRemove,
  onVectorizeImage,
  onVectorizeSelectedImage,
  onUpdateSelected,
  onDeleteSelected,
  onCloseInspector,
  onReplaceSelectedImage,
  scenePxPerSec,
}: LibraryPaneProps) {
  return (
    <div
      className="flex shrink-0"
      style={{
        width: collapsed ? 24 : width,
        borderLeft: '0.5px solid var(--color-border)',
      }}
    >
      {collapsed ? (
        <button
          onClick={() => onToggleCollapsed(false)}
          className="w-full flex items-center justify-center bg-app-surface text-text-dim hover:text-text-primary transition-colors cursor-pointer"
          title="Show library"
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 2L3.5 5L6.5 8" />
          </svg>
        </button>
      ) : (
        <>
          <div
            className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent/30 transition-colors"
            onMouseDown={onResizeStart}
          />
          {selectedAsset ? (
            <AssetInspectorPanel
              asset={selectedAsset}
              onUpdate={onUpdateSelected}
              onDelete={onDeleteSelected}
              onClose={onCloseInspector}
              onReplaceImage={onReplaceSelectedImage}
              onVectorizeImage={onVectorizeSelectedImage}
              scenePxPerSec={scenePxPerSec}
            />
          ) : (
            <WhiteboardLibraryPanel
              catalog={LIBRARY_ASSETS}
              sceneAssets={sceneAssets}
              userSvgs={userSvgs}
              userImages={userImages}
              onAdd={onAdd}
              onAddImage={onAddImage}
              onUploadSvg={onUploadSvg}
              onUploadImage={onUploadImage}
              onRemoveUserSvg={onRemoveUserSvg}
              onRemoveUserImage={onRemoveUserImage}
              onRemove={onRemove}
              onVectorizeImage={onVectorizeImage}
              onCollapse={() => onToggleCollapsed(true)}
            />
          )}
        </>
      )}
    </div>
  );
}
