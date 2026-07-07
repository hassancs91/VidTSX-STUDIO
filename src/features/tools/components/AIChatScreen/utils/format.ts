import type { ThinkingLevel } from '@shared/tsx-engine';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s`;
}

export function getLoadingLabel(elapsedMs: number, thinkingLevel: ThinkingLevel, loopCount: number): string {
  const s = elapsedMs / 1000;
  const hasThinking = thinkingLevel !== 'off';
  const hasReflection = loopCount > 1;

  if (hasThinking && hasReflection) {
    if (s < 3) return 'Starting...';
    if (s < 15) return 'Thinking...';
    if (s < 40) return 'Generating...';
    if (s < 80) return 'Reflecting (pass 2)...';
    if (s < 120) return `Refining (pass ${Math.min(loopCount, 3)})...`;
    return `Finishing (pass ${loopCount})...`;
  }
  if (hasThinking) {
    if (s < 3) return 'Starting...';
    if (s < 15) return 'Thinking...';
    if (s < 40) return 'Reasoning...';
    return 'Generating...';
  }
  if (hasReflection) {
    if (s < 3) return 'Generating...';
    if (s < 20) return 'Generating...';
    if (s < 50) return 'Reflecting (pass 2)...';
    if (s < 80) return `Refining (pass ${Math.min(loopCount, 3)})...`;
    return `Finishing (pass ${loopCount})...`;
  }
  if (s < 3) return 'Generating...';
  if (s < 30) return 'Generating...';
  return 'Still generating...';
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
