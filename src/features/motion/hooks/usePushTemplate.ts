import { useState, useCallback } from 'react';
import type {
  CreatorPushTemplateRequest,
  CreatorPushTemplateResponse,
} from '@shared/ipc/types';

interface UsePushTemplateResult {
  pushing: boolean;
  result: CreatorPushTemplateResponse | null;
  push: (req: CreatorPushTemplateRequest) => Promise<CreatorPushTemplateResponse>;
  reset: () => void;
}

export function usePushTemplate(): UsePushTemplateResult {
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<CreatorPushTemplateResponse | null>(null);

  const push = useCallback(async (req: CreatorPushTemplateRequest) => {
    setPushing(true);
    setResult(null);
    try {
      const res = await window.api.creatorPushTemplate(req);
      setResult(res);
      return res;
    } catch (err) {
      const res: CreatorPushTemplateResponse = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      setResult(res);
      return res;
    } finally {
      setPushing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setPushing(false);
  }, []);

  return { pushing, result, push, reset };
}
