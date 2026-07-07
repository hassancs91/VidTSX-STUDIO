// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UPDATE_FEED_URL = (import.meta as any).env?.VITE_VIDTSX_UPDATE_URL
  || 'https://releases.vidtsx.com/releases';
export const STARTUP_CHECK_DELAY_MS = 10_000;
export const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
