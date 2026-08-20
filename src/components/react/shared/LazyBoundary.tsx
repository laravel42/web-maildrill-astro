import { Component, type ErrorInfo, type ReactNode } from 'react';

type LazyBoundaryProps = {
  children: ReactNode;
  /** Human label for the thing being loaded, used in the fallback copy. */
  label?: string;
  /** Called when the user dismisses the failed boundary (e.g. close the editor). */
  onClose?: () => void;
};

type LazyBoundaryState = { hasError: boolean };

/**
 * Error boundary for lazily-loaded islands (e.g. the visual email editor).
 *
 * `<Suspense>` only handles the PENDING state of `React.lazy`; a REJECTED
 * dynamic import — a chunk 404 after a redeploy, or a flaky network — throws
 * during render and, with no boundary above the island, crashes the whole
 * React tree instead of degrading. This catches that and offers recovery.
 *
 * Recovery is a full reload rather than a soft retry on purpose: `React.lazy`
 * memoises the import promise, so once it rejects, re-rendering the same lazy
 * component just re-throws the cached rejection. A reload re-requests the
 * (now current) chunk manifest, which is what actually fixes a stale-chunk
 * failure after a deploy.
 */
export default class LazyBoundary extends Component<LazyBoundaryProps, LazyBoundaryState> {
  state: LazyBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb; this is a genuine load failure, not benign noise.
    console.error(
      '[LazyBoundary] failed to load',
      this.props.label ?? 'component',
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label ?? 'this view';
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          minHeight: '240px',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink, #1f1e1b)' }}>
          Couldn&rsquo;t load {label}.
        </p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted, #6b6a66)' }}>
          The app may have updated. Reloading fetches the latest version.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent, #4f46e5)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {this.props.onClose ? (
            <button
              type="button"
              onClick={this.props.onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border, #e5e4e0)',
                background: 'transparent',
                color: 'var(--ink, #1f1e1b)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
