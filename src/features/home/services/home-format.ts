import type { HomeSummaryResponse } from '@shared/ipc/types';
import type { HomeContinueItem } from '../types';

/** The Continue row shows this many cards across the three stores. */
export const CONTINUE_LIMIT = 8;

/** Time-of-day greeting — the only "personal" line on the screen. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 d ago", then a date. */
export function formatRelative(ms: number, now: number = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const delta = now - ms;
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} min ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)} h ago`;
  if (delta < 2 * DAY) return 'yesterday';
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)} d ago`;
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function isoMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/** The three recent lists as one row, newest first, capped. */
export function mergeContinueItems(
  summary: Pick<HomeSummaryResponse, 'studioProjects' | 'motionProjects' | 'agentSessions'>,
  limit: number = CONTINUE_LIMIT,
): HomeContinueItem[] {
  const items: HomeContinueItem[] = [];
  for (const p of summary.studioProjects) {
    items.push({
      kind: 'studio',
      key: `studio:${p.id}`,
      title: p.name,
      updatedAtMs: isoMs(p.updatedAt),
      projectId: p.id,
      width: p.width,
      height: p.height,
      updatedAt: p.updatedAt,
      ...(p.posterPath ? { posterPath: p.posterPath } : {}),
      ...(p.brandId ? { brandId: p.brandId } : {}),
    });
  }
  for (const m of summary.motionProjects) {
    items.push({
      kind: 'motion',
      key: `motion:${m.folderPath}`,
      title: m.name,
      updatedAtMs: m.updatedAtMs,
      folderPath: m.folderPath,
      versionPath: m.versionPath,
      versionCount: m.versionCount,
    });
  }
  for (const s of summary.agentSessions) {
    items.push({
      kind: 'session',
      key: `session:${s.agentId}/${s.sessionId}`,
      title: s.title,
      updatedAtMs: isoMs(s.lastOpenedAt),
      agentId: s.agentId,
      agentName: s.agentName,
      sessionId: s.sessionId,
      artifactCount: s.artifactCount,
    });
  }
  return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, limit);
}
