/**
 * Startup half of the AI runtime: register it with the model-library runtime
 * registry (the first runtime that exercises `RuntimeStatus.installable`) and clear
 * staging leftovers. Cheap — no Python is spawned until the user installs or a
 * model runs.
 */
import { registerRuntime } from '../model-library';
import { AI_RUNTIME_CATALOGUE, formatRuntimeBytes } from './catalogue';
import { cleanupAiRuntimeStaging, installAiRuntime } from './install';
import { isAiRuntimeAvailable } from './status';

export async function initAiRuntime(): Promise<void> {
  registerRuntime({
    id: 'pytorch',
    kind: 'python-runtime',
    isAvailable: () => isAiRuntimeAvailable(),
    install: {
      sizeLabel: `${formatRuntimeBytes(AI_RUNTIME_CATALOGUE.cpu.bytes)} – ${formatRuntimeBytes(AI_RUNTIME_CATALOGUE.cu126.bytes)}`,
      start: () => {
        // Errors surface through the status row's lastError, not here.
        void installAiRuntime().catch(() => {});
      },
    },
  });
  await cleanupAiRuntimeStaging();
}
