import { useEffect, useState } from 'react';
import { Button, Panel, ProgressBar, SectionHeader } from '@shared/components';
import { useSystemInfo } from '../hooks/use-system-info';
import type { PyTorchDownloadState } from '../hooks/use-system-info';

interface LibraryTotals {
  imageCount: number;
  imageBytes: number;
}

// ─── Icons ────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7L5.5 10.5L12 4" />
  </svg>
);

const WarningIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5L13 12H1L7 1.5z" />
    <path d="M7 6v3M7 10.5v.5" />
  </svg>
);

const PauseIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor">
    <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
    <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
  </svg>
);

const PlayIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor">
    <path d="M2 1.5L8.5 5L2 8.5V1.5Z" />
  </svg>
);

const CancelIcon = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
    <path d="M2 2L8 8M8 2L2 8" />
  </svg>
);

const DownloadIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5M2 10h8" />
  </svg>
);

// ─── Formatters ───────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000_000) return `${(bytes / 1_000_000_000_000).toFixed(0)} TB`;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(0)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 0) return '';
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────

function SystemRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-primary font-mono">{value}</span>
        {ok ? (
          <span className="text-accent-green"><CheckIcon /></span>
        ) : (
          <span className="text-accent-amber"><WarningIcon /></span>
        )}
      </div>
    </div>
  );
}

interface EngineCardProps {
  color: 'green' | 'blue' | 'amber' | 'red';
  name: string;
  status: string;
  capabilities: string;
}

const DOT_COLORS: Record<string, string> = {
  green: 'bg-accent-green',
  blue: 'bg-accent',
  amber: 'bg-accent-amber',
  red: 'bg-accent-red',
};

function EngineCard({ color, name, status, capabilities }: EngineCardProps) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${DOT_COLORS[color] ?? DOT_COLORS.green}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-primary font-medium">{name}</span>
          <span className="text-[11px] text-text-dim">{status}</span>
        </div>
        <span className="text-[11px] text-text-dim">{capabilities}</span>
      </div>
    </div>
  );
}

function PyTorchDownloadProgress({
  download,
  onPause,
  onResume,
  onCancel,
}: {
  download: PyTorchDownloadState;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const isPaused = download.status === 'paused';
  const isInstalling = download.status === 'installing';

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary">
          {isInstalling ? 'Installing dependencies...' : isPaused ? 'Paused' : 'Downloading...'}
          {' '}{Math.round(download.percent)}%
        </span>
        <div className="flex items-center gap-2">
          {download.speedBps > 0 && (
            <span className="text-[10px] text-text-dim">{formatSpeed(download.speedBps)}</span>
          )}
          {download.etaSeconds > 0 && (
            <span className="text-[10px] text-text-dim">{formatEta(download.etaSeconds)}</span>
          )}
        </div>
      </div>
      <ProgressBar value={download.percent} color={isPaused ? 'amber' : 'purple'} />
      {!isInstalling && (
        <div className="flex items-center gap-1.5 mt-1">
          {isPaused ? (
            <button onClick={onResume} className="text-[10px] text-text-muted hover:text-text-secondary flex items-center gap-0.5" title="Resume">
              <PlayIcon /> Resume
            </button>
          ) : (
            <button onClick={onPause} className="text-[10px] text-text-muted hover:text-text-secondary flex items-center gap-0.5" title="Pause">
              <PauseIcon /> Pause
            </button>
          )}
          <button onClick={onCancel} className="text-[10px] text-text-muted hover:text-accent-red flex items-center gap-0.5" title="Cancel">
            <CancelIcon /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function MainContent() {
  const {
    data,
    loading,
    refresh,
    pytorchDownload,
    pytorchInstall,
    pytorchPause,
    pytorchResume,
    pytorchCancel,
  } = useSystemInfo();
  const [refreshing, setRefreshing] = useState(false);
  const [library, setLibrary] = useState<LibraryTotals | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api
      .modelsScan({ category: 'image' })
      .then((r) => {
        if (cancelled) return;
        setLibrary({
          imageCount: r.installed.length,
          imageBytes: r.installed.reduce((sum, m) => sum + m.sizeBytes, 0),
        });
      })
      .catch(() => {
        /* library totals are best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="py-10 flex flex-col items-center gap-3">
        <svg width="200" height="32" viewBox="0 0 200 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Base line */}
          <line x1="0" y1="16" x2="200" y2="16" stroke="var(--color-border)" strokeWidth="1" />
          {/* Animated scan pulse */}
          <line x1="0" y1="16" x2="200" y2="16" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round">
            <animate attributeName="stroke-dasharray" values="0 200;60 200;0 200" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="stroke-dashoffset" values="0;-200;-400" dur="1.8s" repeatCount="indefinite" />
          </line>
          {/* Pulse dots at peaks */}
          <circle cx="100" cy="16" r="2" fill="var(--color-accent)" opacity="0">
            <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="r" values="1;3;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
          {/* Waveform effect */}
          <polyline
            points="0,16 20,16 30,10 40,22 50,8 60,24 70,12 80,20 90,14 100,16 110,14 120,20 130,12 140,24 150,8 160,22 170,10 180,16 200,16"
            stroke="var(--color-accent)"
            strokeWidth="1"
            fill="none"
            opacity="0.3"
          >
            <animate attributeName="opacity" values="0.1;0.4;0.1" dur="2.2s" repeatCount="indefinite" />
          </polyline>
        </svg>
        <span className="text-[11px] text-text-dim">Detecting system capabilities...</span>
      </div>
    );
  }

  const ramTotalGB = Math.round(data.ram.totalBytes / (1024 * 1024 * 1024));
  const diskFreeGB = Math.round(data.disk.freeBytes / (1024 * 1024 * 1024));
  const hasCuda = data.gpu.cudaVersion !== null;
  const vramTotalGB = data.gpu.vramTotalMB !== null ? Math.round((data.gpu.vramTotalMB / 1024) * 10) / 10 : null;
  const vramFreeGB = data.gpu.vramFreeMB !== null ? Math.round((data.gpu.vramFreeMB / 1024) * 10) / 10 : null;
  const vramValue = vramTotalGB !== null
    ? `${vramTotalGB} GB${vramFreeGB !== null ? ` · ${vramFreeGB} GB free` : ''}`
    : 'Unknown';
  const pytorchInstalled = data.engines.pytorch.installed;
  const cachedWheels = data.engines.pytorch.cachedWheels ?? [];
  const pytorchBusy = pytorchDownload.status === 'downloading' || pytorchDownload.status === 'paused' || pytorchDownload.status === 'installing';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 items-start">
      {/* ── Left column: System + Library ──────────────── */}
      <div>
        <div className="flex items-center justify-between mt-0 mb-3">
          <h3 className="text-[13px] font-medium text-text-primary">System</h3>
          <button
            onClick={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
            disabled={refreshing}
            className="text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
            title="Refresh system info"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
              <path d="M12 5a5.5 5.5 0 0 0-10 1" />
              <path d="M2 9a5.5 5.5 0 0 0 10-1" />
              <polyline points="12 1.5 12 5 8.5 5" />
              <polyline points="2 12.5 2 9 5.5 9" />
            </svg>
          </button>
        </div>
        <Panel className="p-3">
          <SystemRow
            label="GPU"
            value={data.gpu.name ?? 'Not detected'}
            ok={data.gpu.name !== null}
          />
          <SystemRow
            label="VRAM"
            value={vramValue}
            ok={vramTotalGB !== null}
          />
          <SystemRow
            label="CUDA"
            value={data.gpu.cudaVersion ?? 'N/A'}
            ok={hasCuda}
          />
          <SystemRow
            label="RAM"
            value={`${ramTotalGB} GB`}
            ok={ramTotalGB >= 8}
          />
          <SystemRow
            label="Disk"
            value={`${diskFreeGB} GB free`}
            ok={diskFreeGB >= 10}
          />
        </Panel>

        {/* ── Library ──────────────────────────────────── */}
        <SectionHeader>Library</SectionHeader>
        <Panel className="p-3">
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-text-secondary">Image models</span>
            <span className="text-[12px] text-text-primary font-mono">
              {library
                ? `${library.imageCount} model${library.imageCount === 1 ? '' : 's'} · ${formatBytes(library.imageBytes)}`
                : '—'}
            </span>
          </div>
          <div className="text-[10px] text-text-dim mt-1">
            Manage models in the Image tab. Audio / LLM / Embedding totals arrive when those libraries move onto the shared core.
          </div>
        </Panel>
      </div>

      {/* ── Right column: Engines + Python ─────────────── */}
      <div className="mt-6 lg:mt-0">
        <SectionHeader>Engines</SectionHeader>
        <Panel className="p-3 divide-y divide-border">
          <EngineCard
            color={data.engines.audio.available ? 'green' : 'red'}
            name="Audio Engine"
            status={data.engines.audio.available ? 'Bundled' : 'Not available'}
            capabilities="STT &middot; TTS &middot; VAD"
          />
          <EngineCard
            color={data.engines.llm.available ? 'green' : 'red'}
            name="LLM Engine"
            status={data.engines.llm.available ? 'Bundled' : 'Not available'}
            capabilities="Chat &middot; Scripts &middot; Translation"
          />
          <EngineCard
            color="green"
            name="Embedding Engine"
            status="Bundled"
            capabilities="Text &middot; Image &middot; Audio search"
          />
          <EngineCard
            color={data.engines.image.available ? 'green' : 'blue'}
            name="Image Engine"
            status={data.engines.image.available ? 'Bundled' : 'Not available'}
            capabilities="Image gen &middot; Video gen &middot; Upscaling"
          />
          {/* PyTorch row */}
          <div className="py-2">
            <div className="flex items-start gap-2.5">
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${pytorchInstalled ? 'bg-accent-green' : 'bg-accent-amber'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-primary font-medium">
                    PyTorch Runtime
                  </span>
                  <span className="text-[11px] text-text-dim">
                    {pytorchInstalled
                      ? `Installed (${data.engines.pytorch.variant?.toUpperCase() ?? 'unknown'})${data.engines.pytorch.version ? ` v${data.engines.pytorch.version}` : ''}`
                      : 'Not installed'}
                  </span>
                </div>
                <span className="text-[11px] text-text-dim">Voice clone &middot; 3D gen &middot; Audio separation</span>

                {/* Install / Switch buttons or progress */}
                {!pytorchBusy && pytorchDownload.status !== 'completed' && (
                  <div className="flex items-center gap-2 mt-2">
                    {/* CPU button: Install if nothing installed, Switch if GPU is installed */}
                    {(!pytorchInstalled || data.engines.pytorch.variant === 'gpu') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => pytorchInstall('cpu')}
                      >
                        <span className="flex items-center gap-1">
                          <DownloadIcon />
                          {pytorchInstalled
                            ? cachedWheels.includes('cpu') ? 'Switch to CPU' : 'Switch to CPU ~109 MB'
                            : 'Install CPU ~109 MB'}
                        </span>
                      </Button>
                    )}
                    {/* GPU button: Install if nothing installed, Switch if CPU is installed */}
                    {(!pytorchInstalled || data.engines.pytorch.variant === 'cpu') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => pytorchInstall('gpu')}
                        disabled={!hasCuda}
                        title={!hasCuda ? 'Requires NVIDIA GPU with CUDA' : undefined}
                      >
                        <span className="flex items-center gap-1">
                          <DownloadIcon />
                          {pytorchInstalled
                            ? cachedWheels.includes('gpu') ? 'Switch to GPU' : 'Switch to GPU ~2.4 GB'
                            : 'Install GPU ~2.4 GB'}
                        </span>
                      </Button>
                    )}
                  </div>
                )}

                {pytorchBusy && (
                  <PyTorchDownloadProgress
                    download={pytorchDownload}
                    onPause={pytorchPause}
                    onResume={pytorchResume}
                    onCancel={pytorchCancel}
                  />
                )}

                {pytorchDownload.status === 'failed' && (
                  <div className="mt-2">
                    <span className="text-[11px] text-accent-red">
                      {pytorchDownload.error ?? 'Download failed'}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Button variant="secondary" size="sm" onClick={() => pytorchInstall('cpu')}>
                        Retry CPU
                      </Button>
                      {hasCuda && (
                        <Button variant="secondary" size="sm" onClick={() => pytorchInstall('gpu')}>
                          Retry GPU
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Python ───────────────────────────────────── */}
        <SectionHeader>Python</SectionHeader>
        <Panel className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.python.available ? (
                <span className="text-accent-green"><CheckIcon /></span>
              ) : (
                <span className="text-accent-amber"><WarningIcon /></span>
              )}
              <span className="text-[12px] text-text-primary">
                {data.python.available
                  ? <>Python {data.python.version ?? ''} <span className="text-text-dim">(embedded)</span></>
                  : 'Python not found'}
              </span>
            </div>
            <span className="text-[11px] text-text-dim">
              {data.python.available ? 'Bundled' : 'Not found'}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
