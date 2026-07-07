// ─── Skills registry ───
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  whenToUse?: string;
  resources?: string[];
}

export interface SkillsListResponse {
  success: boolean;
  skills: SkillSummary[];
  error?: string;
}
