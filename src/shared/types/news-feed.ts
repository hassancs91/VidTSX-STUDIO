// Announcements feed message shape (V1_RELEASE_PLAN Phase I) — what the
// renderer receives AFTER main-process validation. Raw feed JSON never
// crosses the IPC boundary: main validates, clamps, and date/version-filters
// first (trust rule 1: data only, never code or HTML).

export type NewsMessageType = 'announcement' | 'tip' | 'promo';

export interface NewsMessage {
  id: string;
  /** Styling hook only — unknown types fall back to 'announcement'. */
  type: NewsMessageType;
  title: string;
  body: string;
  /** https:// only (validated in main); opened externally, never in-app. */
  url?: string;
  /** Button label for `url`. */
  cta?: string;
}
