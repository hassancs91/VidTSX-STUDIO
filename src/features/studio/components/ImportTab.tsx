import { useRef } from 'react';
import type { StudioImport, StudioImportKind, StudioAudioTrackKind } from '@shared/ipc/types';
import type { ProxyJob } from '../hooks/useStudioImports';
import { useModuleServerUrl, assetUrl } from '../hooks/useModuleServerUrl';

interface ImportTabProps {
  byKind: Record<StudioImportKind, StudioImport[]>;
  // Import ids that are linked to at least one timeline clip. These can't be
  // removed from the bin — the remove button is disabled with a hint.
  usedImportIds: Set<string>;
  // In-flight / failed proxy generation jobs, keyed by import id.
  proxyJobs: Record<string, ProxyJob>;
  onGenerateProxy: (item: StudioImport) => void;
  onCancelProxy: (id: string) => void;
  onAdd: (kind: StudioImportKind) => void;
  onRemove: (id: string) => void;
  // Per-kind "add to timeline" actions. Video + image append a clip to their
  // track; audio appends to the chosen SFX or Music row.
  onAddVideoToTimeline?: (item: StudioImport) => void;
  onAddImageToTimeline?: (item: StudioImport) => void;
  onAddAudioToTimeline?: (item: StudioImport, track: StudioAudioTrackKind) => void;
}

const SECTIONS: { kind: StudioImportKind; label: string; addLabel: string; emptyHint: string }[] = [
  { kind: 'video', label: 'Videos', addLabel: 'Add videos', emptyHint: 'No videos imported' },
  { kind: 'image', label: 'Images', addLabel: 'Add images', emptyHint: 'No images imported' },
  { kind: 'audio', label: 'Audio', addLabel: 'Add audio', emptyHint: 'No audio imported' },
];

export function ImportTab({
  byKind,
  usedImportIds,
  proxyJobs,
  onGenerateProxy,
  onCancelProxy,
  onAdd,
  onRemove,
  onAddVideoToTimeline,
  onAddImageToTimeline,
  onAddAudioToTimeline,
}: ImportTabProps) {
  const serverUrl = useModuleServerUrl();
  return (
    <div className="flex flex-col gap-[16px] p-[12px] overflow-auto h-full">
      {SECTIONS.map(({ kind, label, addLabel, emptyHint }) => (
        <ImportSection
          key={kind}
          kind={kind}
          label={label}
          addLabel={addLabel}
          emptyHint={emptyHint}
          items={byKind[kind]}
          usedImportIds={usedImportIds}
          proxyJobs={proxyJobs}
          onGenerateProxy={onGenerateProxy}
          onCancelProxy={onCancelProxy}
          serverUrl={serverUrl}
          onAdd={() => onAdd(kind)}
          onRemove={onRemove}
          onAddToTimeline={kind === 'video' ? onAddVideoToTimeline : kind === 'image' ? onAddImageToTimeline : undefined}
          onAddAudioToTimeline={onAddAudioToTimeline}
        />
      ))}
    </div>
  );
}

interface ImportSectionProps {
  kind: StudioImportKind;
  label: string;
  addLabel: string;
  emptyHint: string;
  items: StudioImport[];
  usedImportIds: Set<string>;
  proxyJobs: Record<string, ProxyJob>;
  onGenerateProxy: (item: StudioImport) => void;
  onCancelProxy: (id: string) => void;
  serverUrl: string | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
  // Video + image single-action add.
  onAddToTimeline?: (item: StudioImport) => void;
  // Audio dual-action add (SFX / Music).
  onAddAudioToTimeline?: (item: StudioImport, track: StudioAudioTrackKind) => void;
}

function ImportSection({
  kind,
  label,
  addLabel,
  emptyHint,
  items,
  usedImportIds,
  proxyJobs,
  onGenerateProxy,
  onCancelProxy,
  serverUrl,
  onAdd,
  onRemove,
  onAddToTimeline,
  onAddAudioToTimeline,
}: ImportSectionProps) {
  const showThumbs = items.length > 0 && (kind === 'video' || kind === 'image');

  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-[10px] uppercase tracking-wider">{label}</span>
        <span className="text-text-ghost text-[10px]">{items.length}</span>
      </div>

      <button
        onClick={onAdd}
        className="flex items-center justify-center gap-[6px] h-[28px] rounded-[6px] text-[11px] font-medium transition-colors"
        style={{
          backgroundColor: 'var(--color-app-active)',
          color: 'var(--color-text-muted)',
          border: '0.5px dashed var(--color-border)',
        }}
      >
        <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M6 2V10M2 6H10" />
        </svg>
        {addLabel}
      </button>

      {items.length === 0 ? (
        <span className="text-text-ghost text-[10px] py-[4px]">{emptyHint}</span>
      ) : showThumbs ? (
        <div className="grid grid-cols-2 gap-[6px]">
          {items.map((item) => (
            <ImportTile
              key={item.id}
              item={item}
              inUse={usedImportIds.has(item.id)}
              proxyJob={proxyJobs[item.id]}
              onGenerateProxy={() => onGenerateProxy(item)}
              onCancelProxy={() => onCancelProxy(item.id)}
              serverUrl={serverUrl}
              onRemove={() => onRemove(item.id)}
              onAddToTimeline={onAddToTimeline ? () => onAddToTimeline(item) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-[4px]">
          {items.map((item) => (
            <ImportRow
              key={item.id}
              item={item}
              inUse={usedImportIds.has(item.id)}
              onRemove={() => onRemove(item.id)}
              onAddToSfx={onAddAudioToTimeline ? () => onAddAudioToTimeline(item, 'sfx') : undefined}
              onAddToMusic={onAddAudioToTimeline ? () => onAddAudioToTimeline(item, 'music') : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportTile({
  item,
  inUse,
  proxyJob,
  onGenerateProxy,
  onCancelProxy,
  serverUrl,
  onRemove,
  onAddToTimeline,
}: {
  item: StudioImport;
  inUse: boolean;
  proxyJob?: ProxyJob;
  onGenerateProxy: () => void;
  onCancelProxy: () => void;
  serverUrl: string | null;
  onRemove: () => void;
  onAddToTimeline?: () => void;
}) {
  const url = assetUrl(serverUrl, item.filePath);

  return (
    <div
      className="group flex flex-col gap-[4px] p-[4px] rounded-[6px]"
      style={{ backgroundColor: 'var(--color-app-active)' }}
      title={item.filePath}
    >
      <div
        className="relative w-full aspect-video rounded-[4px] overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-app-deep, #000)' }}
      >
        {url && item.kind === 'image' && (
          <img
            src={url}
            alt={item.fileName}
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}
        {url && item.kind === 'video' && <VideoThumbnail src={url} />}
        {!url && (
          <span className="text-text-ghost text-[9px]">Loading…</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (inUse) return;
            onRemove();
          }}
          disabled={inUse}
          className="absolute top-[2px] right-[2px] opacity-0 group-hover:opacity-100 w-[16px] h-[16px] rounded-[3px] flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:group-hover:opacity-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
          title={inUse ? 'Used in timeline — remove its clips first' : 'Remove'}
        >
          <svg width={8} height={8} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M2 2L8 8M8 2L2 8" />
          </svg>
        </button>
        {item.kind === 'video' && (
          <ProxyControl
            hasProxy={!!item.proxyPath}
            job={proxyJob}
            onGenerate={onGenerateProxy}
            onCancel={onCancelProxy}
          />
        )}
      </div>
      <div className="flex items-center gap-[4px]">
        <span className="text-text-primary text-[10px] truncate flex-1" title={item.fileName}>
          {item.fileName}
        </span>
        {onAddToTimeline && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToTimeline();
            }}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-accent-light)' }}
            title="Add to timeline"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M6 2V10M2 6H10" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Bottom-left chip on a video import tile: generate / show progress / cancel /
// confirm a low-res proxy. Ready state is driven by the import's persisted
// `proxyPath`; transient generating/error state comes from `job`.
function ProxyControl({
  hasProxy,
  job,
  onGenerate,
  onCancel,
}: {
  hasProxy: boolean;
  job?: ProxyJob;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const base =
    'absolute bottom-[2px] left-[2px] flex items-center gap-[3px] h-[16px] px-[5px] rounded-[3px] text-[9px] font-medium transition-all';

  if (job?.status === 'generating') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className={base}
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff' }}
        title="Generating proxy — click to cancel"
      >
        <span>Proxy {job.percent}%</span>
      </button>
    );
  }

  if (job?.status === 'error') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGenerate();
        }}
        className={base}
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'var(--color-status-error, #f09595)' }}
        title={job.error ? `Proxy failed: ${job.error}. Click to retry.` : 'Proxy failed — click to retry'}
      >
        Retry proxy
      </button>
    );
  }

  if (hasProxy) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGenerate();
        }}
        className={`${base} opacity-0 group-hover:opacity-100`}
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--color-accent-light)' }}
        title="Proxy ready (used for preview). Click to regenerate."
      >
        <svg width={8} height={8} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5.5L4 7.5L8 3" />
        </svg>
        Proxy
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onGenerate();
      }}
      className={`${base} opacity-0 group-hover:opacity-100`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--color-text-muted)' }}
      title="Generate a low-res proxy for smooth preview playback"
    >
      Proxy
    </button>
  );
}

function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  // Seek to a small offset on metadata load so Chromium decodes and shows a real frame.
  const handleLoadedMetadata = () => {
    const el = ref.current;
    if (!el) return;
    try {
      el.currentTime = Math.min(0.1, (el.duration || 1) / 2);
    } catch {
      // Some codecs/containers may reject seeking before fully loaded; ignore.
    }
  };

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={handleLoadedMetadata}
      className="w-full h-full object-cover"
    />
  );
}

function ImportRow({
  item,
  inUse,
  onRemove,
  onAddToSfx,
  onAddToMusic,
}: {
  item: StudioImport;
  inUse: boolean;
  onRemove: () => void;
  onAddToSfx?: () => void;
  onAddToMusic?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-[8px] px-[8px] h-[26px] rounded-[4px] group"
      style={{ backgroundColor: 'var(--color-app-active)' }}
      title={item.filePath}
    >
      <AudioGlyph />
      <span className="text-text-primary text-[11px] truncate flex-1">{item.fileName}</span>
      {onAddToSfx && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToSfx();
          }}
          className="opacity-0 group-hover:opacity-100 text-[9px] font-medium px-[4px] h-[16px] rounded-[3px] transition-all"
          style={{ color: 'var(--color-accent-light)' }}
          title="Add to SFX track"
        >
          SFX
        </button>
      )}
      {onAddToMusic && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToMusic();
          }}
          className="opacity-0 group-hover:opacity-100 text-[9px] font-medium px-[4px] h-[16px] rounded-[3px] transition-all"
          style={{ color: 'var(--color-accent-light)' }}
          title="Add to Audio track"
        >
          Audio
        </button>
      )}
      <button
        onClick={() => {
          if (inUse) return;
          onRemove();
        }}
        disabled={inUse}
        className="opacity-0 group-hover:opacity-100 text-text-ghost hover:text-status-error text-[10px] transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-ghost"
        title={inUse ? 'Used in timeline — remove its clips first' : 'Remove'}
      >
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M2 2L8 8M8 2L2 8" />
        </svg>
      </button>
    </div>
  );
}

function AudioGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-dim shrink-0"
    >
      <path d="M6 12V4l7-1v8" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="11.5" cy="11" r="1.5" />
    </svg>
  );
}
