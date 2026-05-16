import { Component, type ReactNode } from "react";

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fo-shell fo-fatal-error" tabIndex={-1}>
          <h1>FileOctopus recovered from a UI error</h1>
          {!isProductionBuild ? <pre>{this.state.error.message}</pre> : null}
          <div className="fo-dialog-actions">
            <button type="button" onClick={() => globalThis.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              onClick={() =>
                void globalThis.navigator.clipboard?.writeText(
                  this.state.error?.stack ?? this.state.error?.message ?? "",
                )
              }
            >
              Copy Diagnostics
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
