import type { RenderQueueJob } from '@shared/ipc/types';
import { GPU_BACKEND_OPTIONS, HARDWARE_ACCELERATION_OPTIONS } from '@shared/components/RenderSettingsModal';
import { useJobProgress } from '../contexts/RenderQueueContext';
import { formatDuration, formatFps, formatFileSize } from '../services/queue-manager';

interface RenderItemDetailsProps {
  job: RenderQueueJob;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] text-text-muted shrink-0">{label}</span>
      <span className="text-[11px] text-text-secondary text-right truncate">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wide text-text-dim mb-0.5">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function cpuUsageLabel(cpuUsage: string | null | undefined): string {
  if (cpuUsage == null) return 'All cores';
  return cpuUsage;
}

function gpuBackendLabel(value: RenderQueueJob['gpuBackend']): string {
  if (!value) return 'Software (default)';
  return GPU_BACKEND_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function hardwareAccelerationLabel(value: RenderQueueJob['hardwareAcceleration']): string {
  if (!value) return 'If possible (default)';
  return HARDWARE_ACCELERATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function outputFileName(outputPath: string): string {
  const parts = outputPath.split(/[/\\]/);
  return parts[parts.length - 1] || outputPath;
}

export function RenderItemDetails({ job }: RenderItemDetailsProps) {
  const liveProgress = useJobProgress(job.status === 'rendering' ? job.id : undefined);

  const scale = job.scale ?? 1;
  const renderedWidth = Math.round(job.width * scale);
  const renderedHeight = Math.round(job.height * scale);

  const framesRendered = liveProgress?.framesRendered ?? job.framesRendered ?? 0;
  const totalFrames = liveProgress?.totalFrames ?? job.totalFrames ?? 0;

  // Elapsed: during render, now - startedAt. On done, completedAt - startedAt.
  // Fall back to createdAt when startedAt isn't stamped (legacy persisted jobs).
  const startRef = job.startedAt ?? job.createdAt;
  const endRef =
    job.status === 'done' || job.status === 'error' || job.status === 'cancelled'
      ? (job.completedAt ?? Date.now())
      : Date.now();
  const elapsedMs = Math.max(0, endRef - startRef);

  const avgFps = elapsedMs > 0 && framesRendered > 0
    ? framesRendered / (elapsedMs / 1000)
    : 0;

  const etaMs = job.status === 'rendering' && avgFps > 0 && totalFrames > framesRendered
    ? ((totalFrames - framesRendered) / avgFps) * 1000
    : null;

  const durationSeconds = totalFrames > 0 && job.fps > 0 ? totalFrames / job.fps : null;

  const showLive = job.status === 'rendering' || job.status === 'done';
  const showOutput = job.status === 'done';

  return (
    <div
      className="px-3 pb-3 pt-1 grid grid-cols-3 gap-x-6 gap-y-3"
      style={{ marginLeft: 76 }}
    >
      {/* Render config */}
      <Section title="Render config">
        <DetailRow label="GPU backend" value={gpuBackendLabel(job.gpuBackend)} />
        <DetailRow label="HW encoding" value={hardwareAccelerationLabel(job.hardwareAcceleration)} />
        {job.encoderName && (
          <DetailRow
            label="Encoder used"
            value={
              <span>
                <span className="font-mono">{job.encoderName}</span>
                <span
                  className="ml-1.5 px-1 rounded text-[9px] font-semibold uppercase"
                  style={{
                    backgroundColor: job.encoderHardwareAccelerated
                      ? 'rgba(120, 200, 140, 0.18)'
                      : 'rgba(200, 200, 200, 0.15)',
                    color: job.encoderHardwareAccelerated
                      ? 'var(--color-accent-green)'
                      : 'var(--color-text-muted)',
                  }}
                >
                  {job.encoderHardwareAccelerated ? 'GPU' : 'CPU'}
                </span>
              </span>
            }
          />
        )}
        <DetailRow label="CPU usage" value={cpuUsageLabel(job.cpuUsage)} />
        <DetailRow
          label="Quality"
          value={
            job.codec === 'prores'
              ? 'ProRes 4444'
              : job.codec === 'webp'
                ? (job.crf != null ? `Quality ${job.crf}` : '—')
                : job.crf != null ? `CRF ${job.crf}` : '—'
          }
        />
        <DetailRow label="FPS" value={`${job.fps}`} />
        <DetailRow label="Scale" value={scale === 1 ? '1×' : `${scale.toFixed(2)}×`} />
        <DetailRow
          label="Resolution"
          value={`${renderedWidth}×${renderedHeight}`}
        />
        <DetailRow label="Audio" value={job.muted ? 'Muted' : 'Included'} />
        <DetailRow label="Alpha" value={job.transparent ? 'Yes' : 'No'} />
        {durationSeconds != null && (
          <DetailRow label="Duration" value={`${durationSeconds.toFixed(1)}s`} />
        )}
      </Section>

      {/* Live performance */}
      {showLive && (
        <Section title={job.status === 'done' ? 'Render stats' : 'Live progress'}>
          <DetailRow
            label="Elapsed"
            value={formatDuration(elapsedMs)}
          />
          <DetailRow
            label="Frames"
            value={totalFrames > 0 ? `${framesRendered} / ${totalFrames}` : `${framesRendered}`}
          />
          <DetailRow label="Avg FPS" value={formatFps(avgFps)} />
          {job.status === 'rendering' && (
            <DetailRow
              label="ETA"
              value={etaMs != null ? formatDuration(etaMs) : '—'}
            />
          )}
          {job.status === 'rendering' && liveProgress?.phase && liveProgress.phase !== 'rendering' && (
            <DetailRow
              label="Phase"
              value={
                liveProgress.phase === 'preparing' ? 'Preparing' :
                liveProgress.phase === 'extracting_audio' ? 'Extracting audio' :
                liveProgress.phase === 'bundling' ? 'Bundling' : liveProgress.phase
              }
            />
          )}
        </Section>
      )}

      {/* Output — done only */}
      {showOutput && (
        <Section title="Output">
          <DetailRow
            label="File"
            value={
              <span title={job.outputPath} className="font-mono">
                {outputFileName(job.outputPath)}
              </span>
            }
          />
          <DetailRow
            label="Total time"
            value={formatDuration(elapsedMs)}
          />
          {job.fileSize != null && (
            <DetailRow label="Size" value={formatFileSize(job.fileSize)} />
          )}
        </Section>
      )}
    </div>
  );
}
