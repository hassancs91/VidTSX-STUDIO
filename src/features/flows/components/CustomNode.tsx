import { useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getNodeDef } from '../nodes';
import { DATA_TYPE_COLOR, type DataType, type PortDef } from '../nodes/types';
import { useNodeRunState } from '../hooks/useFlowRun';
import type { NodeRunStatus } from '../services/run-flow';

// In-memory cache so re-renders (or multiple hydrations of the same run) don't
// hit imageStudioRead repeatedly. Keyed by gallery entry id.
const imageRefCache = new Map<string, string>();

function useImageFromRef(imageRef: string | undefined): string | null {
  const [base64, setBase64] = useState<string | null>(() =>
    imageRef ? imageRefCache.get(imageRef) ?? null : null,
  );

  useEffect(() => {
    if (!imageRef) {
      setBase64(null);
      return;
    }
    const cached = imageRefCache.get(imageRef);
    if (cached) {
      setBase64(cached);
      return;
    }
    let cancelled = false;
    void window.api
      .imageStudioRead({ id: imageRef })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.base64) {
          imageRefCache.set(imageRef, res.base64);
          setBase64(res.base64);
        }
      })
      .catch(() => {
        // Best-effort — leaves preview blank rather than crashing the node.
      });
    return () => {
      cancelled = true;
    };
  }, [imageRef]);

  return base64;
}

// Cache resolved video-studio paths so re-renders of past runs don't keep
// re-invoking the IPC. Keyed by videoStudio entry id.
const videoRefCache = new Map<string, string>();

function useVideoFromRef(videoRef: string | undefined): string | null {
  const [fileUrl, setFileUrl] = useState<string | null>(() =>
    videoRef ? videoRefCache.get(videoRef) ?? null : null,
  );

  useEffect(() => {
    if (!videoRef) {
      setFileUrl(null);
      return;
    }
    const cached = videoRefCache.get(videoRef);
    if (cached) {
      setFileUrl(cached);
      return;
    }
    let cancelled = false;
    void window.api
      .videoStudioReadPath({ id: videoRef })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.filePath) {
          const url = `file:///${res.filePath.replace(/\\/g, '/')}`;
          videoRefCache.set(videoRef, url);
          setFileUrl(url);
        }
      })
      .catch(() => {
        // Best-effort — falls back to remote URL.
      });
    return () => {
      cancelled = true;
    };
  }, [videoRef]);

  return fileUrl;
}

interface NodeData {
  typeId: string;
  config: Record<string, unknown>;
}

const HANDLE_SIZE = 10;

const STATUS_BORDER: Record<NodeRunStatus, string> = {
  idle: 'var(--color-border)',
  running: 'var(--color-accent)',
  done: '#34d399',
  error: 'var(--color-accent-red)',
  skipped: 'var(--color-border)',
};

const DATA_TYPE_LABEL: Record<DataType, string> = {
  text: 'Text',
  image: 'Image',
  images: 'Images (multiple)',
  video: 'Video',
  audio: 'Audio',
  composition: 'Composition',
  transcript: 'Transcript',
  number: 'Number',
};

function PortHandle({
  port,
  position,
  index,
  total,
}: {
  port: PortDef;
  position: Position;
  index: number;
  total: number;
}) {
  const [hovered, setHovered] = useState(false);
  const offset = total === 1 ? 50 : 25 + (50 * index) / Math.max(1, total - 1);
  const isInput = position === Position.Left;

  return (
    <>
      <Handle
        id={port.id}
        type={isInput ? 'target' : 'source'}
        position={position}
        style={{
          top: `${offset}%`,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          background: DATA_TYPE_COLOR[port.dataType],
          border: '2px solid #1a1a1e',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none whitespace-nowrap px-2 py-1 rounded-md bg-app-deep shadow-lg"
          style={{
            top: `${offset}%`,
            transform: 'translateY(-50%)',
            border: '0.5px solid var(--color-border)',
            ...(isInput
              ? { right: 'calc(100% + 8px)' }
              : { left: 'calc(100% + 8px)' }),
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: DATA_TYPE_COLOR[port.dataType] }}
            />
            <span className="text-[11px] font-medium text-text-primary">{port.label}</span>
            {port.required && (
              <span className="text-[9px] uppercase tracking-wider text-accent-red">required</span>
            )}
          </div>
          <div className="text-[9px] text-text-dim mt-0.5 pl-3">
            {DATA_TYPE_LABEL[port.dataType]} · {isInput ? 'input' : 'output'}
          </div>
        </div>
      )}
    </>
  );
}

function StatusIndicator({ status, error }: { status: NodeRunStatus; error?: string }) {
  if (status === 'idle') return null;
  if (status === 'running') {
    return (
      <Loader2
        size={12}
        strokeWidth={2}
        className="animate-spin text-accent absolute top-2 right-2"
      />
    );
  }
  if (status === 'done') {
    return (
      <span
        className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"
        title="Done"
      />
    );
  }
  if (status === 'error') {
    return (
      <AlertCircle
        size={12}
        strokeWidth={2}
        className="text-accent-red absolute top-2 right-2"
        aria-label={error}
      />
    );
  }
  if (status === 'skipped') {
    return (
      <span
        className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-text-dim"
      >
        Skipped
      </span>
    );
  }
  return null;
}

function ImagePreview({ base64 }: { base64: string }) {
  return (
    <div className="px-2 pb-2">
      <div
        className="rounded bg-app-deep overflow-hidden flex items-center justify-center"
        style={{ height: 120, border: '0.5px solid var(--color-border)' }}
      >
        <img
          src={`data:image/jpeg;base64,${base64}`}
          alt="Generated"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}

function ImagePreviewFromRef({ imageRef }: { imageRef: string }) {
  const base64 = useImageFromRef(imageRef);
  if (!base64) {
    return (
      <div className="px-2 pb-2">
        <div
          className="rounded bg-app-deep flex items-center justify-center"
          style={{ height: 120, border: '0.5px solid var(--color-border)' }}
        >
          <Loader2 size={14} strokeWidth={1.8} className="animate-spin text-text-dim" />
        </div>
      </div>
    );
  }
  return <ImagePreview base64={base64} />;
}

function VideoPreview({ url, videoRef }: { url?: string; videoRef?: string }) {
  const localUrl = useVideoFromRef(videoRef);
  const src = localUrl ?? url ?? null;
  if (!src) return null;
  return (
    <div className="px-2 pb-2">
      <div
        className="rounded bg-app-deep overflow-hidden flex items-center justify-center"
        style={{ height: 120, border: '0.5px solid var(--color-border)' }}
      >
        <video
          src={src}
          controls
          muted
          playsInline
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}

function OutputPreview({ output }: { output?: Record<string, unknown> }) {
  if (!output) return null;

  // Live runs: full base64 in `image`. Hydrated past runs: only `imageRef`
  // (a gallery entry id) — base64 was stripped before persistence to keep
  // flow_runs.node_results small.
  const image = output.image;
  if (typeof image === 'string' && image.length > 0) {
    return <ImagePreview base64={image} />;
  }
  const imageRef = output.imageRef;
  if (typeof imageRef === 'string' && imageRef.length > 0) {
    return <ImagePreviewFromRef imageRef={imageRef} />;
  }

  const video = output.video;
  const videoRef = output.videoRef;
  if (
    (typeof video === 'string' && video.length > 0) ||
    (typeof videoRef === 'string' && videoRef.length > 0)
  ) {
    return (
      <VideoPreview
        url={typeof video === 'string' ? video : undefined}
        videoRef={typeof videoRef === 'string' ? videoRef : undefined}
      />
    );
  }

  const text = output.text;
  if (typeof text === 'string' && text.length > 0) {
    return (
      <div
        className="px-2 pb-2 text-[10px] text-text-muted line-clamp-3 break-words"
        title={text}
      >
        {text}
      </div>
    );
  }
  return null;
}

export function CustomNode({ id, data, selected }: NodeProps<NodeData>) {
  const def = getNodeDef(data.typeId);
  const runState = useNodeRunState(id);

  if (!def) {
    return (
      <div
        className="px-3 py-2 rounded-md bg-app-surface text-[11px] text-accent-red"
        style={{ border: '1px solid var(--color-accent-red)' }}
      >
        Unknown node: {data.typeId}
      </div>
    );
  }

  const minHeight = Math.max(def.inputs.length, def.outputs.length, 1) * 22 + 32;
  const borderColor = selected ? 'var(--color-accent)' : STATUS_BORDER[runState.status];
  const borderWidth = selected || runState.status !== 'idle' ? '1px' : '0.5px';

  return (
    <div
      className="rounded-md bg-app-surface text-text-primary"
      style={{
        width: 220,
        minHeight,
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow:
          selected ? '0 0 0 2px rgba(127, 119, 221, 0.25)'
          : runState.status === 'running' ? '0 0 0 2px rgba(127, 119, 221, 0.18)'
          : 'none',
      }}
    >
      <div className="relative px-3 py-2">
        <div className="text-[12px] font-semibold truncate pr-5">{def.label}</div>
        <div className="text-[10px] uppercase tracking-wider text-text-dim mt-0.5">
          {def.category}
        </div>
        <StatusIndicator status={runState.status} error={runState.error} />
      </div>

      {runState.status === 'done' && <OutputPreview output={runState.output} />}

      {runState.status === 'error' && runState.error && (
        <div
          className="mx-2 mb-2 px-2 py-1 rounded text-[10px] text-accent-red"
          style={{ background: 'rgba(244, 63, 94, 0.08)', border: '0.5px solid rgba(244, 63, 94, 0.3)' }}
        >
          {runState.error}
        </div>
      )}

      {def.inputs.map((port, i) => (
        <PortHandle
          key={'in-' + port.id}
          port={port}
          position={Position.Left}
          index={i}
          total={def.inputs.length}
        />
      ))}
      {def.outputs.map((port, i) => (
        <PortHandle
          key={'out-' + port.id}
          port={port}
          position={Position.Right}
          index={i}
          total={def.outputs.length}
        />
      ))}
    </div>
  );
}
