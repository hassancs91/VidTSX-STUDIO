/** Categories of content that can be flagged */
export type ModerationCategory = 'sexual' | 'nudity' | 'pornography' | 'profanity';

/** Severity levels for matched content */
export type ModerationSeverity = 'low' | 'medium' | 'high';

/** A single word/phrase match found during moderation */
export interface ModerationMatch {
  /** The original term from the word list that matched */
  term: string;
  /** Which category this term belongs to */
  category: ModerationCategory;
  /** Language code of the matched term (e.g., 'en', 'ar', 'es') */
  language: string;
  /** Severity of the matched term */
  severity: ModerationSeverity;
}

/** Result returned by moderationEngine.check() */
export interface ModerationResult {
  /** Whether the text was flagged as containing prohibited content */
  flagged: boolean;
  /** List of specific matches found (empty if not flagged) */
  matches: ModerationMatch[];
  /** Summary of categories that were triggered */
  categories: ModerationCategory[];
}

/** A word-list entry used in the internal registry */
export interface ModerationTerm {
  term: string;
  category: ModerationCategory;
  language: string;
  severity: ModerationSeverity;
}
