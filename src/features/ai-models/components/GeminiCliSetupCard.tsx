import { Button, Panel } from '@shared/components';
import { useGeminiCliStatus } from '../hooks/useGeminiCliStatus';

const INSTALL_COMMAND = 'irm https://antigravity.google/cli/install.ps1 | iex';

/**
 * Setup card for Google subscription images (Nano Banana 2 via the
 * Antigravity CLI). Detect + auth probe + install instructions — install and
 * sign-in stay manual and interactive (browser OAuth); the app never
 * automates account sign-in, it detects and explains.
 */
export function GeminiCliSetupCard() {
  const { status, loading, refresh } = useGeminiCliStatus();

  // Nothing to say until the first probe answers.
  if (!status && loading) return null;

  const installed = status?.installed ?? false;
  const authenticated = status?.authenticated ?? false;
  const ready = installed && authenticated;

  return (
    <Panel className="p-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-text-primary font-medium">
            {ready
              ? 'Google subscription images — ready'
              : installed
                ? 'Google subscription images — sign in required'
                : 'Set up Google subscription images'}
          </div>
          <div className="text-[11px] text-text-dim mt-0.5">
            {ready ? (
              <>
                Nano Banana 2 runs on your Google AI subscription via the Antigravity CLI —
                no API key, no per-image cost. Pick “Google (subscription)” as the provider
                in Image Studio.
              </>
            ) : installed ? (
              <>
                The Antigravity CLI is installed but its Google sign-in isn’t working
                {status?.detail ? ` (${status.detail})` : ''}. Run <code className="text-text-primary">agy</code> in
                a terminal, sign in with the Google account that holds your AI subscription, then check again.
              </>
            ) : (
              <>
                Generate with Nano Banana 2 on your Google AI Pro/Ultra subscription — no API
                key. Install the Antigravity CLI in PowerShell, run <code className="text-text-primary">agy</code> once
                to sign in, then check again:
              </>
            )}
          </div>
          {!installed && (
            <code className="block mt-1.5 px-2 py-1 rounded bg-app-base text-[11px] text-text-primary overflow-x-auto whitespace-nowrap">
              {INSTALL_COMMAND}
            </code>
          )}
        </div>
        {!ready && (
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading} className="shrink-0">
            {loading ? 'Checking…' : 'Check again'}
          </Button>
        )}
      </div>
    </Panel>
  );
}
