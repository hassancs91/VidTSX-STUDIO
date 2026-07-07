import { useRenderQueueContext } from '../contexts/RenderQueueContext';

export function useRenderQueue() {
  return useRenderQueueContext();
}
