import { Panel } from '@shared/components';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { useImageCliStatus } from '../../hooks/useImageCliStatus';
import type { LlmProvidersApi } from '../../hooks/useProviderKeyDrafts';
import { CliSubscriptionRow, type CliSubscriptionCopy } from './CliSubscriptionRow';
import type { LlmProviderTestState } from './LlmProviderRow';
import { LlmSubscriptionRow } from './LlmSubscriptionRow';
import { ProviderGridHeader } from './ProviderGridRow';

const isCustomProvider = (id: string) => id.startsWith('custom-');

/** Google subscription images (Nano Banana 2 through the Antigravity CLI). */
const GEMINI_CLI_COPY: CliSubscriptionCopy = {
  ready: (
    <>
      Nano Banana 2 runs on your Google AI subscription — no key, no per-image cost. Pick “Google (subscription)” as the
      provider in Image Studio.
    </>
  ),
  signIn: (
    <>
      The Antigravity CLI is installed but its Google sign-in isn’t working. Run <code className="text-text-primary">agy</code> in a
      terminal and sign in with the account that holds your AI subscription.
    </>
  ),
  install: <>Generate with Nano Banana 2 on a Google AI Pro / Ultra subscription — no API key. Install the Antigravity CLI to start.</>,
  steps: [
    'Open PowerShell and run the install command below.',
    <>
      Run <code className="text-text-primary">agy</code> once and sign in with the Google account that holds your AI subscription.
    </>,
    'Come back here and click Check again.',
  ],
  installCommand: 'irm https://antigravity.google/cli/install.ps1 | iex',
};

interface SubscriptionsSectionProps {
  llm: LlmProvidersApi;
  onLlmChange: (id: string, updates: Partial<LlmProviderConfig>) => void;
}

/**
 * Providers that need no API key because an account the user already pays
 * for does the work: Claude through the Claude Code sign-in, Google images
 * through the Antigravity CLI (moved here from the Image tab, redesign §3.2).
 * The OpenAI Codex row joins in the plan's P5.
 */
export function SubscriptionsSection({ llm, onLlmChange }: SubscriptionsSectionProps) {
  const gemini = useImageCliStatus('gemini-cli');
  const subscriptionLlms = llm.providers.filter(
    (p) => p.authMode === 'subscription' && p.id !== 'local' && !isCustomProvider(p.id),
  );

  return (
    <Panel>
      <ProviderGridHeader detailLabel="Details" />
      {subscriptionLlms.map((provider) => (
        <LlmSubscriptionRow
          key={provider.id}
          provider={provider}
          testState={llm.testStates[provider.id] as LlmProviderTestState | undefined}
          onUpdate={onLlmChange}
          onTest={llm.testProvider}
        />
      ))}
      <CliSubscriptionRow
        rowId="gemini-cli"
        name="Google Antigravity"
        capabilities={['Images']}
        status={gemini.status}
        loading={gemini.loading}
        onRefresh={() => void gemini.refresh()}
        copy={GEMINI_CLI_COPY}
      />
    </Panel>
  );
}
