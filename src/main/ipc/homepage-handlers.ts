import { vidtsxFetch } from '../services/api-config';
import { logEngine } from '../../logging/log-engine';
import type { HomepageData, HomepageGetResponse } from '../../shared/ipc/types';

const HOMEPAGE_ENDPOINT = '/api/v1/homepage/';
const REQUEST_TIMEOUT_MS = 10_000;

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('enotfound')
    || msg.includes('network') || msg.includes('etimedout') || msg.includes('abort');
}

function friendlyError(err: unknown, status?: number): string {
  if (isNetworkError(err)) {
    return 'Could not reach the server. Check your internet connection.';
  }
  if (status) {
    if (status >= 500) return 'Server error. Please try again later.';
    if (status === 404) return 'Homepage content not found.';
  }
  return 'Could not load homepage content.';
}

export async function handleHomepageGet(): Promise<HomepageGetResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await vidtsxFetch(HOMEPAGE_ENDPOINT, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      logEngine.warn('Homepage', `GET ${HOMEPAGE_ENDPOINT} returned ${res.status}`);
      return { success: false, error: friendlyError(null, res.status) };
    }

    const text = await res.text();
    let data: HomepageData;
    try {
      data = JSON.parse(text) as HomepageData;
    } catch (parseErr) {
      logEngine.error('Homepage', 'Non-JSON response', parseErr, { body: text.slice(0, 500) });
      return { success: false, error: 'Server returned an invalid response' };
    }

    return { success: true, data };
  } catch (err) {
    const actualErr = err instanceof Error ? err : new Error(String(err));
    if (!isNetworkError(err)) {
      logEngine.error('Homepage', 'Fetch failed', actualErr);
    }
    return { success: false, error: friendlyError(err) };
  } finally {
    clearTimeout(timeout);
  }
}
