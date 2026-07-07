import type { ImageStudioSaveRequest } from '../../shared/ipc/types';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BASE64_LENGTH = 20_000_000; // ~15MB decoded
const MAX_PROMPT_LENGTH = 10_000;
const MAX_MODEL_LENGTH = 500;
const MAX_DIMENSION = 8192;
const MAX_FOLDER_NAME_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNSAFE_FOLDER_CHARS = /[/\\:\0]/;

interface ValidationResult<T> {
  valid: true;
  data: T;
}

interface ValidationError {
  valid: false;
  error: string;
}

export function validateSaveImageInput(
  data: ImageStudioSaveRequest
): ValidationResult<ImageStudioSaveRequest> | ValidationError {
  if (typeof data.base64 !== 'string' || data.base64.length > MAX_BASE64_LENGTH) {
    return { valid: false, error: `Image data exceeds maximum size (${Math.round(MAX_BASE64_LENGTH / 1_000_000)}MB)` };
  }

  if (!ALLOWED_CONTENT_TYPES.includes(data.contentType as typeof ALLOWED_CONTENT_TYPES[number])) {
    return { valid: false, error: `Invalid content type: ${data.contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}` };
  }

  if (typeof data.prompt !== 'string' || data.prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt exceeds maximum length (${MAX_PROMPT_LENGTH} characters)` };
  }

  if (typeof data.model !== 'string' || data.model.length > MAX_MODEL_LENGTH) {
    return { valid: false, error: `Model name exceeds maximum length (${MAX_MODEL_LENGTH} characters)` };
  }

  if (!Number.isInteger(data.width) || data.width < 1 || data.width > MAX_DIMENSION) {
    return { valid: false, error: `Width must be between 1 and ${MAX_DIMENSION}` };
  }

  if (!Number.isInteger(data.height) || data.height < 1 || data.height > MAX_DIMENSION) {
    return { valid: false, error: `Height must be between 1 and ${MAX_DIMENSION}` };
  }

  if (typeof data.durationMs !== 'number' || data.durationMs < 0) {
    return { valid: false, error: 'Duration must be a non-negative number' };
  }

  if (data.folderId != null && (typeof data.folderId !== 'string' || !UUID_PATTERN.test(data.folderId))) {
    return { valid: false, error: 'Invalid folder ID format' };
  }

  return { valid: true, data };
}

export function validateFolderName(
  name: unknown
): ValidationResult<string> | ValidationError {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Folder name must be a string' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }

  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
    return { valid: false, error: `Folder name exceeds maximum length (${MAX_FOLDER_NAME_LENGTH} characters)` };
  }

  if (UNSAFE_FOLDER_CHARS.test(trimmed)) {
    return { valid: false, error: 'Folder name contains invalid characters' };
  }

  return { valid: true, data: trimmed };
}
