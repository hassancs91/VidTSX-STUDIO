import { AiModelsSections } from './AiModelsSections';

/**
 * Top-level "AI Models" screen: the standard 40 px toolbar, then a section
 * rail + content that fill the rest of the window at any width
 * (docs/ai-models-redesign.md §2). Gated behind the `ai-models` feature flag.
 */
export function AiModelsScreen() {
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex h-[40px] shrink-0 items-center bg-app-surface px-3"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">AI Models</span>
      </div>

      <div className="min-h-0 flex-1 bg-app-base">
        <AiModelsSections />
      </div>
    </div>
  );
}
