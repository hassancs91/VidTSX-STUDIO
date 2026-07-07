import { Component, type ReactNode } from 'react';
import { ImageStudioScreen } from './ImageStudioScreen';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ImageStudioErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ImageStudio] Render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-dim gap-3">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[13px]">Something went wrong</span>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-[11px] bg-app-base border border-border text-text-secondary hover:border-accent transition-colors"
            onClick={() => this.setState({ hasError: false })}
          >
            Reload Image Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ImageStudioScreenWithBoundary() {
  return (
    <ImageStudioErrorBoundary>
      <ImageStudioScreen />
    </ImageStudioErrorBoundary>
  );
}
