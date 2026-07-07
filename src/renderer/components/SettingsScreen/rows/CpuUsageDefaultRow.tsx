import type { RenderCpuUsage } from '@shared/ipc/types';

const CPU_USAGE_SETTING_OPTIONS: { value: RenderCpuUsage; label: string; hint: string }[] = [
  { value: 'low', label: 'Low — 25%', hint: 'Machine stays fully usable' },
  { value: 'medium', label: 'Medium — 50%', hint: 'Balanced' },
  { value: 'high', label: 'High — 75%', hint: 'Faster render' },
  { value: 'max', label: 'Max — all cores', hint: 'Fastest; may lag the system' },
];

export function CpuUsageDefaultRow({
  renderDefaultCpuUsage,
  setRenderDefaultCpuUsage,
  settingsLoading,
}: {
  renderDefaultCpuUsage: RenderCpuUsage;
  setRenderDefaultCpuUsage: (value: RenderCpuUsage) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-text-muted mb-1">
            Default CPU usage
          </div>
          <div className="text-[10px] text-text-dim">
            Pre-selected in the render settings modal. Override per-render if needed.
          </div>
        </div>
        <select
          className="bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
          value={renderDefaultCpuUsage}
          onChange={(e) => void setRenderDefaultCpuUsage(e.target.value as RenderCpuUsage)}
          disabled={settingsLoading}
        >
          {CPU_USAGE_SETTING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
