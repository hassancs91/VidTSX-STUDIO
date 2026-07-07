import { useMemo, useRef, useState } from 'react';
import { Trash2, Upload, Wand2 } from 'lucide-react';
import type { Asset, AssetCategory, LibraryAsset, UserImageAsset, UserSvgAsset } from '../types';
import { isDrawableAsset, isImageAsset } from '../types';
import { AssetPreview } from './AssetPreview';
import { IS_VECTORIZE_ENABLED } from '../services/whiteboard-service';

interface Props {
  catalog: LibraryAsset[];
  sceneAssets: Asset[];
  userSvgs: UserSvgAsset[];
  userImages: UserImageAsset[];
  onAdd: (asset: LibraryAsset) => void;
  onAddImage: (asset: UserImageAsset) => void;
  onUploadSvg: (file: File) => Promise<void>;
  onUploadImage: (file: File) => Promise<void>;
  onRemoveUserSvg: (id: string) => void;
  onRemoveUserImage: (id: string) => void;
  onRemove: (index: number) => void;
  /** Phase 12: launch the vectorize modal for an uploaded image. Renders a
   *  hover-action wand button on each user image card when provided. */
  onVectorizeImage?: (img: UserImageAsset) => void;
  onCollapse: () => void;
}

type FilterCategory = 'all' | AssetCategory;

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  all: 'All',
  shapes: 'Shapes',
  nature: 'Nature',
  objects: 'Objects',
  arrows: 'Arrows',
  people: 'People',
};

const CATEGORY_ORDER: FilterCategory[] = [
  'all',
  'shapes',
  'nature',
  'objects',
  'arrows',
  'people',
];

type LibraryTab = 'library' | 'my-svgs' | 'my-images';

const TAB_LABELS: Record<LibraryTab, string> = {
  library: 'Library',
  'my-svgs': 'My SVGs',
  'my-images': 'My Images',
};

const TAB_ORDER: LibraryTab[] = ['library', 'my-svgs', 'my-images'];

export function WhiteboardLibraryPanel({
  catalog,
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
  onCollapse,
}: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [activeTab, setActiveTab] = useState<LibraryTab>('library');
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);
  const [svgUploading, setSvgUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const svgInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const sortedUserSvgs = useMemo(
    () => [...userSvgs].sort((a, b) => b.createdAt - a.createdAt),
    [userSvgs]
  );

  const sortedUserImages = useMemo(
    () => [...userImages].sort((a, b) => b.createdAt - a.createdAt),
    [userImages]
  );

  const handlePickSvg = () => {
    setSvgUploadError(null);
    svgInputRef.current?.click();
  };

  const handleSvgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSvgUploading(true);
    try {
      await onUploadSvg(file);
    } catch (err) {
      setSvgUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSvgUploading(false);
    }
  };

  const handlePickImage = () => {
    setImageUploadError(null);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploading(true);
    try {
      await onUploadImage(file);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteUserSvg = (svg: UserSvgAsset) => {
    const ok = window.confirm(`Delete "${svg.name}"? This cannot be undone.`);
    if (ok) onRemoveUserSvg(svg.id);
  };

  const handleDeleteUserImage = (img: UserImageAsset) => {
    const ok = window.confirm(`Delete "${img.name}"? This cannot be undone.`);
    if (ok) onRemoveUserImage(img.id);
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalog.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [catalog, search, category]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-app-surface">
      <div
        className="flex items-center justify-between px-3 h-[36px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] uppercase tracking-wider text-text-dim">Library</span>
        <button
          onClick={onCollapse}
          className="text-text-dim hover:text-text-primary transition-colors"
          title="Hide library"
        >
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 2L6.5 5L3.5 8" />
          </svg>
        </button>
      </div>

      <div
        className="flex items-center gap-1 px-3 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
        role="tablist"
      >
        {TAB_ORDER.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 h-[22px] text-[11px] rounded-md transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
              }`}
              style={{
                border: active
                  ? '0.5px solid transparent'
                  : '0.5px solid var(--color-border)',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'library' ? (
          <>
            <div className="px-3 pt-3 pb-2 flex flex-col gap-2 shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-[28px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none"
                style={{ border: '0.5px solid var(--color-border)' }}
              />
              <div className="flex flex-wrap gap-1">
                {CATEGORY_ORDER.map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-2 h-[22px] text-[11px] rounded-md transition-colors ${
                        active
                          ? 'bg-accent text-white'
                          : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                      }`}
                      style={{
                        border: active
                          ? '0.5px solid transparent'
                          : '0.5px solid var(--color-border)',
                      }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-auto px-3 pb-3">
              {filtered.length === 0 ? (
                <div className="text-[11px] text-text-dim text-center py-6">No matches</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => onAdd(asset)}
                      className="flex flex-col items-center gap-1 p-2 rounded-md bg-app-base hover:bg-app-hover transition-colors"
                      style={{ border: '0.5px solid var(--color-border)' }}
                      title={`Add ${asset.name}`}
                    >
                      <div className="w-full aspect-square flex items-center justify-center">
                        <AssetPreview asset={asset} size={56} />
                      </div>
                      <span className="text-[10px] text-text-secondary truncate w-full text-center">
                        {asset.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'my-svgs' ? (
          <>
            <div className="px-3 pt-3 pb-2 flex flex-col gap-2 shrink-0">
              <button
                onClick={handlePickSvg}
                disabled={svgUploading}
                className="w-full h-[32px] px-2 flex items-center justify-center gap-1.5 text-[12px] rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Upload size={12} strokeWidth={1.75} />
                <span>{svgUploading ? 'Uploading…' : 'Upload SVG'}</span>
              </button>
              <input
                ref={svgInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleSvgFileChange}
                className="hidden"
              />
              {svgUploadError && (
                <div className="text-[10px] text-red-500 truncate" title={svgUploadError}>
                  {svgUploadError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto px-3 pb-3">
              {sortedUserSvgs.length === 0 ? (
                <div className="text-[11px] text-text-dim text-center py-6">
                  No SVGs yet — upload your first
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sortedUserSvgs.map((svg) => (
                    <div
                      key={svg.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onAdd(svg)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAdd(svg);
                        }
                      }}
                      className="group relative flex flex-col items-center gap-1 p-2 rounded-md bg-app-base hover:bg-app-hover transition-colors cursor-pointer"
                      style={{ border: '0.5px solid var(--color-border)' }}
                      title={`Add ${svg.name}`}
                    >
                      <div className="w-full aspect-square flex items-center justify-center">
                        <AssetPreview asset={svg} size={56} />
                      </div>
                      <span className="text-[10px] text-text-secondary truncate w-full text-center">
                        {svg.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUserSvg(svg);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-md bg-app-deep/80 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete SVG"
                      >
                        <Trash2 size={11} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-3 pt-3 pb-2 flex flex-col gap-2 shrink-0">
              <button
                onClick={handlePickImage}
                disabled={imageUploading}
                className="w-full h-[32px] px-2 flex items-center justify-center gap-1.5 text-[12px] rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Upload size={12} strokeWidth={1.75} />
                <span>{imageUploading ? 'Uploading…' : 'Upload Image'}</span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageFileChange}
                className="hidden"
              />
              {imageUploadError && (
                <div className="text-[10px] text-red-500 truncate" title={imageUploadError}>
                  {imageUploadError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto px-3 pb-3">
              {sortedUserImages.length === 0 ? (
                <div className="text-[11px] text-text-dim text-center py-6">
                  No images yet — upload your first
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sortedUserImages.map((img) => (
                    <div
                      key={img.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onAddImage(img)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAddImage(img);
                        }
                      }}
                      className="group relative flex flex-col items-center gap-1 p-2 rounded-md bg-app-base hover:bg-app-hover transition-colors cursor-pointer"
                      style={{ border: '0.5px solid var(--color-border)' }}
                      title={`Add ${img.name}`}
                    >
                      <div className="w-full aspect-square flex items-center justify-center bg-app-deep rounded-sm overflow-hidden">
                        <img
                          src={img.src}
                          alt={img.name}
                          className="w-full h-full object-contain"
                          draggable={false}
                        />
                      </div>
                      <span className="text-[10px] text-text-secondary truncate w-full text-center">
                        {img.name}
                      </span>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {IS_VECTORIZE_ENABLED && onVectorizeImage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onVectorizeImage(img);
                            }}
                            className="p-1 rounded-md bg-app-deep/80 text-text-muted hover:text-accent transition-colors"
                            title="Vectorize image"
                          >
                            <Wand2 size={11} strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUserImage(img);
                          }}
                          className="p-1 rounded-md bg-app-deep/80 text-text-muted hover:text-red-500 transition-colors"
                          title="Delete image"
                        >
                          <Trash2 size={11} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div
          className="shrink-0 flex flex-col"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-text-dim">
              Scene
            </span>
            <span className="text-[10px] text-text-dim tabular-nums">
              {sceneAssets.length}
            </span>
          </div>
          <div className="px-3 pb-3 max-h-[180px] overflow-auto flex flex-col gap-1">
            {sceneAssets.length === 0 ? (
              <div className="text-[11px] text-text-dim py-2">No assets yet</div>
            ) : (
              sceneAssets.map((asset, i) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-app-hover transition-colors"
                >
                  <div className="w-[28px] h-[28px] flex items-center justify-center shrink-0 bg-app-base rounded-sm overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
                    {isDrawableAsset(asset) ? (
                      <AssetPreview asset={asset} size={24} />
                    ) : isImageAsset(asset) ? (
                      <img
                        src={asset.src}
                        alt={asset.name ?? 'Image'}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-[10px] text-text-dim">T</span>
                    )}
                  </div>
                  <span className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">
                    {sceneLabel(asset)}
                  </span>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-text-dim hover:text-red-500 transition-colors p-1"
                    title="Remove"
                  >
                    <Trash2 size={12} strokeWidth={1.75} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function sceneLabel(asset: Asset): string {
  if (isImageAsset(asset)) {
    return asset.name ?? 'Image';
  }
  if (!isDrawableAsset(asset)) {
    // Text asset; richer label (truncated text content) lands in step 11.7.
    return 'Text';
  }
  // Scene assets carry the library prefix (e.g. "lib-tree:abc123" or
  // "lib-house"). Reverse-lookup their human-readable name from the prefix.
  const baseId = asset.id.split(':')[0];
  const friendly = baseId.replace(/^lib-/, '').replace(/-/g, ' ');
  return friendly.charAt(0).toUpperCase() + friendly.slice(1);
}
