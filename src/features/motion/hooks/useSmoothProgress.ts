// Moved to @shared/hooks/useSmoothProgress so the Studio feature can reuse it
// without violating the cross-feature import rule. This file is a thin
// re-export for existing Motion callers.
export { useSmoothProgress } from '@shared/hooks/useSmoothProgress';
