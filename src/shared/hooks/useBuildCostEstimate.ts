import { useEffect, useState } from 'react';
import type { BuildBudget, TsxBuildCostEstimate } from '@shared/ipc/types';

/**
 * The builder run's cost before Start (TSX_BUILDER_DESIGN.md P5 part 3), for
 * the budget hints in the Creator and Studio. Null until it arrives (the hint
 * then shows the looks and the time cap alone). `providerId` absent = the
 * active provider; `model` absent or '' = its default.
 */
export function useBuildCostEstimate(
  providerId: string | undefined,
  model: string | undefined,
  budget: BuildBudget,
): TsxBuildCostEstimate | null {
  const [estimate, setEstimate] = useState<TsxBuildCostEstimate | null>(null);
  useEffect(() => {
    let disposed = false;
    setEstimate(null);
    window.api.tsxBuildCostEstimate({
      ...(providerId ? { providerId } : {}),
      ...(model ? { model } : {}),
      budget,
    })
      .then((res) => {
        if (!disposed) setEstimate(res);
      })
      .catch(() => {});
    return () => { disposed = true; };
  }, [providerId, model, budget]);
  return estimate;
}
