// Phase I3 contract: disabled means NO fetch at all (off = the app doesn't
// phone), dismissed ids never come back, and news never surfaces an error.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsMessage } from '../../shared/types/news-feed';

const mocks = vi.hoisted(() => ({
  getNewsEnabled: vi.fn(),
  setNewsEnabled: vi.fn(),
  getNewsDismissedIds: vi.fn(),
  addNewsDismissedId: vi.fn(),
  getNewsMessages: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0' },
}));
vi.mock('../services/settings', () => ({
  getNewsEnabled: mocks.getNewsEnabled,
  setNewsEnabled: mocks.setNewsEnabled,
  getNewsDismissedIds: mocks.getNewsDismissedIds,
  addNewsDismissedId: mocks.addNewsDismissedId,
}));
vi.mock('../services/news-feed', () => ({
  getNewsMessages: mocks.getNewsMessages,
}));

import { handleNewsDismiss, handleNewsGet, handleNewsSetEnabled } from './news-handlers';

const event = {} as Parameters<typeof handleNewsDismiss>[0];

const msg = (id: string): NewsMessage => ({
  id,
  type: 'announcement',
  title: `Title ${id}`,
  body: 'Body',
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNewsEnabled.mockResolvedValue(true);
  mocks.getNewsDismissedIds.mockResolvedValue([]);
  mocks.getNewsMessages.mockResolvedValue([]);
});

describe('handleNewsGet', () => {
  it('returns empty WITHOUT fetching when the feature is off', async () => {
    mocks.getNewsEnabled.mockResolvedValue(false);
    expect(await handleNewsGet()).toEqual({ success: true, enabled: false, messages: [] });
    expect(mocks.getNewsMessages).not.toHaveBeenCalled();
  });

  it('filters dismissed ids out of the validated messages', async () => {
    mocks.getNewsMessages.mockResolvedValue([msg('a'), msg('b'), msg('c')]);
    mocks.getNewsDismissedIds.mockResolvedValue(['b']);
    const res = await handleNewsGet();
    expect(res.success).toBe(true);
    expect(res.enabled).toBe(true);
    expect(res.messages.map((m) => m.id)).toEqual(['a', 'c']);
    expect(mocks.getNewsMessages).toHaveBeenCalledWith({ appVersion: '1.0.0' });
  });

  it('a settings failure degrades to empty, never a throw', async () => {
    mocks.getNewsEnabled.mockRejectedValue(new Error('db locked'));
    const res = await handleNewsGet();
    expect(res.success).toBe(false);
    expect(res.messages).toEqual([]);
  });
});

describe('handleNewsDismiss / handleNewsSetEnabled', () => {
  it('persists a dismissal', async () => {
    expect(await handleNewsDismiss(event, { id: 'a' })).toEqual({ success: true });
    expect(mocks.addNewsDismissedId).toHaveBeenCalledWith('a');
  });

  it('rejects an empty id', async () => {
    const res = await handleNewsDismiss(event, { id: '' });
    expect(res.success).toBe(false);
    expect(mocks.addNewsDismissedId).not.toHaveBeenCalled();
  });

  it('writes the enabled flag', async () => {
    expect(await handleNewsSetEnabled(event, { enabled: false })).toEqual({ success: true });
    expect(mocks.setNewsEnabled).toHaveBeenCalledWith(false);
  });
});
