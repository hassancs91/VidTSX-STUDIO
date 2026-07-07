// ─── Moderation types ───
export interface ModerationCheckRequest {
  text: string;
}

export interface ModerationCheckResponse {
  flagged: boolean;
  matches: {
    term: string;
    category: string;
    language: string;
    severity: string;
  }[];
  categories: string[];
  termCount: number;
  languages: string[];
}
