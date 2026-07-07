export interface ParseResult {
  success: boolean;
  prompts: string[];
  error?: string;
}

export function parseBulkJson(content: string): ParseResult {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return { success: false, prompts: [], error: 'Expected a JSON array of strings' };
    }
    const prompts: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') {
        return { success: false, prompts: [], error: 'All items must be strings' };
      }
      prompts.push(item.trim());
    }
    return { success: true, prompts };
  } catch {
    return { success: false, prompts: [], error: 'Invalid JSON' };
  }
}

export function validateBulkPrompts(prompts: string[]): { valid: string[]; emptyCount: number } {
  const valid = prompts.map((p) => p.trim()).filter((p) => p.length > 0);
  return { valid, emptyCount: prompts.length - valid.length };
}
