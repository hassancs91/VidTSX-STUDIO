// Options for the per-project "AI Assistant provider" select (InspectorPanel).
// Pure so the H2 stranding rule is testable: a persisted
// `settings.agent.providerId` that no longer matches a visible provider must
// render as an EXPLICIT "(unavailable)" row, never a silently blank select —
// the project would keep sending that id every turn while the UI showed
// nothing (V1_RELEASE_PLAN Phase H2). The runtime half of the promise lives
// in studio-agent, which falls back to the app default for unknown ids.

import type { LlmProviderConfig } from '@shared/ipc/types';

export interface ProviderOption {
  value: string;
  label: string;
}

export function buildAgentProviderOptions(
  providers: LlmProviderConfig[],
  selectedProviderId: string | undefined,
): ProviderOption[] {
  const options: ProviderOption[] = [
    { value: '', label: 'App default (active provider)' },
    ...providers.map((p) => ({ value: p.id, label: p.name })),
  ];
  // providers.length guards the pre-fetch render (list arrives async) — an
  // empty list means "not loaded yet", not "this id is gone".
  if (
    selectedProviderId &&
    providers.length > 0 &&
    !providers.some((p) => p.id === selectedProviderId)
  ) {
    options.push({
      value: selectedProviderId,
      label: `${selectedProviderId} (unavailable — agent uses the app default)`,
    });
  }
  return options;
}
