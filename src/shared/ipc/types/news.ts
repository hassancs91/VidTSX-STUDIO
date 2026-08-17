import type { NewsMessage } from '../../types/news-feed';

// Announcements feed IPC (V1_RELEASE_PLAN Phase I3). Raw feed JSON never
// crosses this boundary — main validates/clamps first, and messages arrive
// already filtered for date window, version, and dismissals.

/** news:get — validated messages minus dismissed; empty when disabled.
 *  `enabled` rides along so the Settings toggle reads one source of truth. */
export interface NewsGetResponse {
  success: boolean;
  enabled: boolean;
  messages: NewsMessage[];
  error?: string;
}

/** news:dismiss — persist one message id; it never reshows. */
export interface NewsDismissRequest {
  id: string;
}

export interface NewsDismissResponse {
  success: boolean;
  error?: string;
}

/** news:set-enabled — the "Show news and announcements" toggle (I5). */
export interface NewsSetEnabledRequest {
  enabled: boolean;
}

export interface NewsSetEnabledResponse {
  success: boolean;
  error?: string;
}
