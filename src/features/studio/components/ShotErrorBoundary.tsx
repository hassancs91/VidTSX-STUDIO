import { Component, type ErrorInfo, type ReactNode } from 'react';
import { shotErrorHint, windowErrorHint } from '../services/shot-error-hint';

interface Props {
  /** Shot display name for the placeholder label. */
  label: string;
  /** The shot's module URL: an uncaught error from it with a known cause (shot-error-hint.ts) also shows the tile. */
  moduleUrl?: string;
  children: ReactNode;
}

interface State {
  error: string | null;
}

/**
 * Containment for live shot modules in the preview (TSX_SHOTS_DESIGN.md D4):
 * a throwing shot renders a labeled placeholder tile instead of
 * white-screening the whole Player. Wrapped around each shot component by the
 * PREVIEW supplier only — the export entry deliberately stays unwrapped so a
 * broken shot fails the render loudly, not silently.
 *
 * A class component is the one sanctioned exception to the functional-only
 * rule: React has no hook API for error boundaries.
 */
export class ShotErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // The placeholder already tells the story; nothing else to do.
  }

  // A 3D shot's own reconciler root (R3F) throws outside this boundary (P3 part 6, D9).
  private readonly onWindowError = (event: ErrorEvent): void => {
    const message = windowErrorHint(event.error, this.props.moduleUrl ?? '');
    if (message !== null && this.state.error === null) this.setState({ error: message });
  };

  componentDidMount(): void {
    if (this.props.moduleUrl) window.addEventListener('error', this.onWindowError);
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.onWindowError);
  }

  render() {
    if (this.state.error !== null) {
      return <ShotPlaceholder label={this.props.label} detail={this.state.error} />;
    }
    return this.props.children;
  }
}

/** The labeled tile shown for a crashed (or still-loading) shot. A known cause reads as its hint; the raw error stays in the tooltip. */
export function ShotPlaceholder({ label, detail }: { label: string; detail?: string }) {
  const hint = detail ? shotErrorHint(detail) : null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'rgba(30, 28, 40, 0.85)',
        border: '1px dashed rgba(200, 180, 255, 0.4)',
        color: 'rgba(230, 225, 255, 0.85)',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }} title={hint ? detail : undefined}>
        {hint ?? detail ?? 'Shot unavailable'}
      </div>
    </div>
  );
}
