// ─── Creator (dev-only) template push ───
// Creator (dev-only) template push
export interface CreatorPushTemplateRequest {
  tsxFilePath: string;
  mp4Path: string;
  thumbnailPath: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  isPremium: boolean;
  featured: boolean;
}

export interface CreatorGenerateThumbnailRequest {
  mp4Path: string;
  tsxFilePath: string;
}

export interface CreatorGenerateThumbnailResponse {
  success: boolean;
  thumbnailPath?: string;
  sizeBytes?: number;
  error?: string;
}

export interface CreatorPushDraft {
  title: string;
  slug: string;
  slugEdited: boolean;
  description: string;
  tags: string[];
  isPremium: boolean;
  featured: boolean;
  updatedAt: string;
  pushedAt?: string;
  templateId?: string;
  templateUrl?: string;
}

export interface CreatorLoadDraftRequest {
  tsxFilePath: string;
}

export interface CreatorLoadDraftResponse {
  draft: CreatorPushDraft | null;
  thumbnailPath: string | null;
  thumbnailSize: number | null;
}

export interface CreatorSaveDraftRequest {
  tsxFilePath: string;
  draft: Omit<CreatorPushDraft, 'updatedAt'>;
}

export interface CreatorSaveDraftResponse {
  success: boolean;
  error?: string;
}

export interface CreatorPushTemplateResponse {
  success: boolean;
  templateId?: string;
  url?: string;
  error?: string;
}

// ─── Creator TSX archive — fire-and-forget on render ───
// Creator TSX archive — fire-and-forget on render.
export interface CreatorArchiveTsxRequest {
  tsxFilePath: string;
  prompt: string;
  modelName: string;
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  generationTimeMs?: number;
  projectName?: string;
  videoDurationSeconds?: number;
}

export interface CreatorArchiveTsxResponse {
  success: boolean;
  archiveId?: string;
  error?: string;
  skipped?: 'no-license' | 'no-api-url' | 'no-tsx';
}
