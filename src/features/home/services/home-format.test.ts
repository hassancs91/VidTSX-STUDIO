import { describe, expect, it } from 'vitest';
import { formatRelative, greetingFor, mergeContinueItems } from './home-format';

describe('greetingFor', () => {
  it('follows the hour', () => {
    expect(greetingFor(2)).toBe('Good evening');
    expect(greetingFor(7)).toBe('Good morning');
    expect(greetingFor(13)).toBe('Good afternoon');
    expect(greetingFor(21)).toBe('Good evening');
  });
});

describe('formatRelative', () => {
  const now = Date.UTC(2026, 8, 10, 12, 0, 0);
  it('scales from "just now" to days', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now');
    expect(formatRelative(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatRelative(now - 30 * 3_600_000, now)).toBe('yesterday');
    expect(formatRelative(now - 4 * 86_400_000, now)).toBe('4 d ago');
  });
  it('falls back to a date past a week and to nothing for garbage', () => {
    expect(formatRelative(now - 30 * 86_400_000, now)).toMatch(/Aug/);
    expect(formatRelative(0, now)).toBe('');
    expect(formatRelative(Number.NaN, now)).toBe('');
  });
});

describe('mergeContinueItems', () => {
  const studio = (id: string, updatedAt: string) => ({
    id,
    name: id,
    width: 1920,
    height: 1080,
    fps: 30,
    createdAt: updatedAt,
    updatedAt,
    assetCount: 0,
    folderPath: `C:/p/${id}`,
  });
  it('interleaves the three stores newest first and caps the row', () => {
    const items = mergeContinueItems(
      {
        studioProjects: [studio('a', '2026-09-10T10:00:00Z'), studio('b', '2026-09-01T10:00:00Z')],
        motionProjects: [
          { folderPath: 'C:/m/x', name: 'x', versionPath: 'C:/m/x/v2.tsx', versionCount: 2, updatedAtMs: Date.UTC(2026, 8, 9) },
        ],
        agentSessions: [
          { agentId: 'v/a', agentName: 'A', sessionId: 's1', title: 'S1', lastOpenedAt: '2026-09-10T11:00:00Z', artifactCount: 1 },
        ],
      },
      3,
    );
    expect(items.map((i) => i.key)).toEqual(['session:v/a/s1', 'studio:a', 'motion:C:/m/x']);
  });
  it('carries the poster and brand only when present', () => {
    const [plain] = mergeContinueItems({ studioProjects: [studio('a', '2026-09-10T10:00:00Z')], motionProjects: [], agentSessions: [] });
    expect(plain.kind === 'studio' && 'posterPath' in plain).toBe(false);
    const [posted] = mergeContinueItems({
      studioProjects: [{ ...studio('a', '2026-09-10T10:00:00Z'), posterPath: 'poster.jpg', brandId: 'acme' }],
      motionProjects: [],
      agentSessions: [],
    });
    expect(posted.kind === 'studio' ? posted.posterPath : null).toBe('poster.jpg');
    expect(posted.kind === 'studio' ? posted.brandId : null).toBe('acme');
  });
});
