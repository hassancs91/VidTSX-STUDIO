import { GPU_BACKEND_OPTIONS } from '@shared/components/RenderSettingsModal';
import type { RenderGpuBackend } from '@shared/ipc/types';

export function GpuBackendDefaultRow({
  renderDefaultGpuBackend,
  setRenderDefaultGpuBackend,
  settingsLoading,
}: {
  renderDefaultGpuBackend: RenderGpuBackend;
  setRenderDefaultGpuBackend: (value: RenderGpuBackend) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  const hint = GPU_BACKEND_OPTIONS.find((o) => o.value === renderDefaultGpuBackend)?.hint ?? '';
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">
            Default GPU backend
          </div>
          <div className="text-[10px] text-text-dim">
            Chromium GL backend used during render. Software is safe everywhere; GPU backends
            are faster for WebGL/3D but need compatible drivers and may crash. Override per-render
            in the render modal.
          </div>
          <div className="text-[10px] text-text-dim mt-1 italic">{hint}</div>
        </div>
        <select
          className="bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer shrink-0"
          value={renderDefaultGpuBackend}
          onChange={(e) => void setRenderDefaultGpuBackend(e.target.value as RenderGpuBackend)}
          disabled={settingsLoading}
        >
          {GPU_BACKEND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
