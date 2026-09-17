import { useState } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { useSystemInfo } from '../../hooks/use-system-info';
import { LocalSectionPanel } from '../local/LocalSectionPanel';

function HardwareRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5" data-hardware-row={label.toLowerCase()}>
      <span className="text-[12px] text-text-secondary">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[12px] text-text-primary" title={value}>
          {value}
        </span>
        {ok ? (
          <Check size={13} strokeWidth={2} className="shrink-0 text-accent-green" />
        ) : (
          <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0 text-accent-amber" />
        )}
      </div>
    </div>
  );
}

/** Overview → Hardware: GPU · VRAM (total / free) · CUDA · RAM · Disk, with a refresh. */
export function HardwarePanel() {
  const { data, loading, refresh } = useSystemInfo();
  const [refreshing, setRefreshing] = useState(false);

  const ramTotalGB = data ? Math.round(data.ram.totalBytes / 1024 ** 3) : 0;
  const diskFreeGB = data ? Math.round(data.disk.freeBytes / 1024 ** 3) : 0;
  const vramTotalGB = data?.gpu.vramTotalMB != null ? Math.round((data.gpu.vramTotalMB / 1024) * 10) / 10 : null;
  const vramFreeGB = data?.gpu.vramFreeMB != null ? Math.round((data.gpu.vramFreeMB / 1024) * 10) / 10 : null;

  return (
    <LocalSectionPanel
      id="hardware"
      title="Hardware"
      aside={
        <button
          type="button"
          onClick={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          disabled={refreshing || loading}
          className="cursor-pointer text-text-muted transition-colors duration-150 hover:text-text-secondary disabled:opacity-50"
          title="Refresh hardware info"
          aria-label="Refresh hardware info"
        >
          <RefreshCw size={13} strokeWidth={1.5} className={refreshing ? 'animate-spin' : ''} />
        </button>
      }
      isEmpty={loading || !data}
      empty="Detecting system capabilities…"
    >
      {data && (
        <div className="py-1">
          <HardwareRow label="GPU" value={data.gpu.name ?? 'Not detected'} ok={data.gpu.name !== null} />
          <HardwareRow
            label="VRAM"
            value={vramTotalGB !== null ? `${vramTotalGB} GB${vramFreeGB !== null ? ` · ${vramFreeGB} GB free` : ''}` : 'Unknown'}
            ok={vramTotalGB !== null}
          />
          <HardwareRow label="CUDA" value={data.gpu.cudaVersion ?? 'N/A'} ok={data.gpu.cudaVersion !== null} />
          <HardwareRow label="RAM" value={`${ramTotalGB} GB`} ok={ramTotalGB >= 8} />
          <HardwareRow label="Disk" value={`${diskFreeGB} GB free`} ok={diskFreeGB >= 10} />
        </div>
      )}
    </LocalSectionPanel>
  );
}
