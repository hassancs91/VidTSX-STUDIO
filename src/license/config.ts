// The license/provider API host is resolved centrally in
// main/services/api-config.ts (vidtsx.com with mcp.vidtsx.com fallback during
// the migration); call vidtsxFetch there instead of building a base URL here.
export const GRACE_PERIOD_DAYS = 7;
export const VALIDATION_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
