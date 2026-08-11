import type { RenderCodec, RenderQueueJob } from '@shared/ipc/types';

/**
 * Generate output path for a render job
 */
export function generateOutputPath(
  compositionId: string,
  videosDir: string,
  codec: RenderCodec
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const ext = getExtensionForCodec(codec);
  // Use forward slashes for path joining (works on Windows too)
  return `${videosDir}/${compositionId}_${timestamp}.${ext}`;
}

/**
 * Get file extension for a codec
 */
export function getExtensionForCodec(codec: RenderCodec): string {
  switch (codec) {
    case 'h264':
    case 'h265':
      return 'mp4';
    case 'vp8':
    case 'vp9':
      return 'webm';
    case 'prores':
      return 'mov';
    case 'gif':
      return 'gif';
    case 'webp':
      return 'webp';
    default:
      return 'mp4';
  }
}

/**
 * Get format label for display (e.g., "MP4", "WebM", "GIF")
 */
export function getFormatLabel(codec: RenderCodec): string {
  switch (codec) {
    case 'h264':
    case 'h265':
      return 'MP4';
    case 'vp8':
    case 'vp9':
      return 'WebM';
    case 'prores':
      return 'MOV';
    case 'gif':
      return 'GIF';
    case 'webp':
      return 'WebP';
    default:
      return 'MP4';
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format resolution for display (e.g., "1080p", "720p", "4K")
 */
export function formatResolution(width: number, height: number): string {
  // Portrait or square
  if (height >= width) {
    if (height >= 2160) return '4K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    return `${height}p`;
  }
  // Landscape
  if (height >= 2160) return '4K';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  return `${height}p`;
}

/**
 * Format a duration in milliseconds as "M:SS" or "H:MM:SS".
 * Used for elapsed time, ETA, and total render time in the job details panel.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Render avg FPS as "12.3 fps" (one decimal). Returns '—' for non-finite inputs
 * (e.g., divide-by-zero before the first frame).
 */
export function formatFps(fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) return '—';
  return `${fps.toFixed(1)} fps`;
}

/**
 * Check if a job is older than a certain number of days
 */
export function isJobOlderThan(job: RenderQueueJob, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return job.createdAt < cutoff;
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `render_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
