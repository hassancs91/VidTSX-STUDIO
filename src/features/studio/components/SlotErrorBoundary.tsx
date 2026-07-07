import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SlotErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            color: 'white',
            fontSize: 10,
          }}
        >
          Overlay error
        </div>
      );
    }
    return this.props.children;
  }
}
