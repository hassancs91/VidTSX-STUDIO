import { AiModelsTab } from './AiModelsTab';

/**
 * Top-level "AI Models" screen (design D4) — wraps the existing tabbed
 * `AiModelsTab` with the standard screen toolbar/layout (same pattern as
 * ToolsHubScreen). Gated behind the `ai-models` feature flag.
 */
export function AiModelsScreen() {
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">AI Models</span>
      </div>

      <div className="flex-1 overflow-auto bg-app-base p-4">
        <div className="max-w-[760px]">
          <AiModelsTab />
        </div>
      </div>
    </div>
  );
}
