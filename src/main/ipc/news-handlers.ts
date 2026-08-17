// Announcements feed IPC (Phase I3) — thin glue over the I1 feed service and
// the I2 settings fields. Trust rule: when the feature is disabled, the GET
// returns empty WITHOUT fetching — off means the app doesn't phone at all.

import { app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  NewsDismissRequest,
  NewsDismissResponse,
  NewsGetResponse,
  NewsSetEnabledRequest,
  NewsSetEnabledResponse,
} from '../../shared/ipc/types';
import { getNewsMessages } from '../services/news-feed';
import {
  addNewsDismissedId,
  getNewsDismissedIds,
  getNewsEnabled,
  setNewsEnabled,
} from '../services/settings';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleNewsGet(): Promise<NewsGetResponse> {
  try {
    const enabled = await getNewsEnabled();
    if (!enabled) return { success: true, enabled: false, messages: [] };
    const [messages, dismissedIds] = await Promise.all([
      getNewsMessages({ appVersion: app.getVersion() }),
      getNewsDismissedIds(),
    ]);
    const dismissed = new Set(dismissedIds);
    return {
      success: true,
      enabled: true,
      messages: messages.filter((m) => !dismissed.has(m.id)),
    };
  } catch (err) {
    // The feed itself never throws — this guards the settings reads. News is
    // never worth surfacing an error for.
    return {
      success: false,
      enabled: false,
      messages: [],
      error: errorMessage(err, 'Failed to load announcements'),
    };
  }
}

export async function handleNewsDismiss(
  _event: IpcMainInvokeEvent,
  data: NewsDismissRequest,
): Promise<NewsDismissResponse> {
  try {
    if (!data.id) return { success: false, error: 'A message id is required' };
    await addNewsDismissedId(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to dismiss the message') };
  }
}

export async function handleNewsSetEnabled(
  _event: IpcMainInvokeEvent,
  data: NewsSetEnabledRequest,
): Promise<NewsSetEnabledResponse> {
  try {
    await setNewsEnabled(data.enabled);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update the setting') };
  }
}
