import { useState, useCallback } from 'react';
import type {
  CreatorGenerateThumbnailRequest,
  CreatorGenerateThumbnailResponse,
} from '@shared/ipc/types';

interface UseGenerateThumbnailResult {
  generating: boolean;
  result: CreatorGenerateThumbnailResponse | null;
  generate: (req: CreatorGenerateThumbnailRequest) => Promise<CreatorGenerateThumbnailResponse>;
  reset: () => void;
}

export function useGenerateThumbnail(): UseGenerateThumbnailResult {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CreatorGenerateThumbnailResponse | null>(null);

  const generate = useCallback(async (req: CreatorGenerateThumbnailRequest) => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await window.api.creatorGenerateThumbnail(req);
      setResult(res);
      return res;
    } catch (err) {
      const res: CreatorGenerateThumbnailResponse = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      setResult(res);
      return res;
    } finally {
      setGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setGenerating(false);
  }, []);

  return { generating, result, generate, reset };
}
