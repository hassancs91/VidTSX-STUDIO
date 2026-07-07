import { HARDWARE_ACCELERATION_OPTIONS } from '@shared/components/RenderSettingsModal';
import type { RenderHardwareAcceleration } from '@shared/ipc/types';

export function HardwareAccelerationDefaultRow({
  renderDefaultHardwareAcceleration,
  setRenderDefaultHardwareAcceleration,
  settingsLoading,
}: {
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  setRenderDefaultHardwareAcceleration: (value: RenderHardwareAcceleration) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  const hint = HARDWARE_ACCELERATION_OPTIONS.find((o) => o.value === renderDefaultHardwareAcceleration)?.hint ?? '';
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">
            Default hardware video encoding
          </div>
          <div className="text-[10px] text-text-dim">
            Routes video encoding to the GPU's dedicated encoder (NVENC/QSV/AMF/VideoToolbox)
            when available. "If possible" auto-detects and falls back to CPU silently — big
            speed win on modern hardware. Override per-render in the render modal.
          </div>
          <div className="text-[10px] text-text-dim mt-1 italic">{hint}</div>
        </div>
        <select
          className="bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer shrink-0"
          value={renderDefaultHardwareAcceleration}
          onChange={(e) => void setRenderDefaultHardwareAcceleration(e.target.value as RenderHardwareAcceleration)}
          disabled={settingsLoading}
        >
          {HARDWARE_ACCELERATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
