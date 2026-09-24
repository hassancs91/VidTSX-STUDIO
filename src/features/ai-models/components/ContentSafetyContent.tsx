import { useContentSafetyStatus } from '../hooks/use-content-safety-status';

// Where false-positive reports go (D5: feedback is a mailto, nothing
// automated). TODO(Hasan): confirm the address before the public flip.
const FEEDBACK_EMAIL = 'support@vidtsx.com';

const ShieldIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5L13.5 3.5V7.5C13.5 10.5 11.2 13.2 8 14.5C4.8 13.2 2.5 10.5 2.5 7.5V3.5L8 1.5Z" />
    <path d="M5.5 8L7.2 9.7L10.5 6.4" />
  </svg>
);

function StatCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="bg-app-card border border-app-border rounded-md px-4 py-3 min-w-[130px]" data-testid={testId}>
      <div className="text-[18px] font-semibold text-text-primary tabular-nums">{value}</div>
      <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

export function ContentSafetyContent() {
  const { status, error } = useContentSafetyStatus();

  const classifierState = !status
    ? '…'
    : status.devBypass
      ? 'Bypassed (dev)'
      : !status.classifier.present
      ? 'Missing — generation blocked'
      : status.classifier.loaded
        ? 'Active'
        : 'Ready (loads on first use)';

  return (
    <div className="max-w-2xl" data-testid="content-safety-page">
      <div className="flex items-center gap-2 mb-1 text-accent-light">
        <ShieldIcon />
        <h2 className="text-[14px] font-semibold text-text-primary">Content Safety</h2>
      </div>

      {/* Dev builds only: the literal DEV guard drops this from release bundles. */}
      {import.meta.env.DEV && status?.devBypass && (
        <div
          className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1.5 mt-2 mb-3"
          data-testid="cs-dev-bypass-banner"
        >
          Dev bypass active — the prompt blocklist and the pixel classifier are OFF for this
          session (VIDTSX_DEV_DISABLE_CONTENT_SAFETY=1). Sexualized-minor terms still block.
          This switch does not exist in release builds.
        </div>
      )}

      <p className="text-[12px] text-text-secondary leading-relaxed mb-4">
        VidTSX Studio ships with built-in content safeguards for everything it generates —
        always on, and they cannot be disabled in the app. Sexual and explicit content is
        refused at the prompt, and every generated image, reference input, video frame
        sample, and webpage capture is checked by a local classifier before it reaches
        your project. All processing happens on this machine; nothing about blocked
        content ever leaves it.
      </p>

      {error && (
        <div className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1.5 mb-4">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <StatCard
          label="Prompts blocked"
          value={status ? String(status.blockedCounts.prompt) : '…'}
          testId="cs-blocked-prompt"
        />
        <StatCard
          label="Images / frames blocked"
          value={status ? String(status.blockedCounts.image) : '…'}
          testId="cs-blocked-image"
        />
        <StatCard label="Classifier" value={classifierState} testId="cs-classifier-state" />
      </div>

      <h3 className="text-[12px] font-semibold text-text-primary mb-1.5">What is blocked</h3>
      <ul className="text-[12px] text-text-secondary leading-relaxed list-disc pl-5 mb-4 space-y-0.5">
        <li>
          <span className="text-text-primary">Sexual, nudity, and pornographic content</span> — a
          curated multilingual blocklist ({status ? status.promptTermCount.toLocaleString() : '…'}{' '}
          terms) refuses obvious requests instantly; sexualized-minor content is blocked with the
          highest priority.
        </li>
        <li>
          <span className="text-text-primary">Explicit pixels</span> — an on-device NSFW classifier
          (Apache-2.0, bundled with the app) screens every generated result. Borderline results
          are blocked too: a false positive on a generated image only costs a re-roll.
        </li>
      </ul>

      <h3 className="text-[12px] font-semibold text-text-primary mb-1.5">What is not scanned</h3>
      <p className="text-[12px] text-text-secondary leading-relaxed mb-4">
        Your own footage and library are yours. The gate covers what the app generates and
        captures — it never scans imported media. Profanity in scripts and captions is never
        blocked either; creators swear, and the gate only cares about visual content.
      </p>

      <h3 className="text-[12px] font-semibold text-text-primary mb-1.5">If a prompt was wrongly blocked</h3>
      <p className="text-[12px] text-text-secondary leading-relaxed mb-1.5">
        Blocks name a category, never the matched word. Rephrasing usually resolves it — e.g.
        “skin-tone palette” instead of “nude palette”. If a reasonable prompt keeps getting
        blocked, tell us:{' '}
        <a className="text-accent-light hover:underline" href={`mailto:${FEEDBACK_EMAIL}?subject=Content%20Safety%20false%20positive`}>
          {FEEDBACK_EMAIL}
        </a>
        .
      </p>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Model: {status?.classifier.file ?? '…'}
        {status?.classifier.sha256 ? ` · sha256 ${status.classifier.sha256.slice(0, 12)}…` : ''}
        {' · '}counters are stored locally and never uploaded.
      </p>
    </div>
  );
}
