import { Component, type ReactNode } from "react";
import { API_BASE } from "../lib/store";
import { Remy } from "./common";

/** Reports a client-side error to the server log so crashes on the live site
 * show up in the host's logs (the browser console isn't visible to us). */
export function reportClientError(where: string, error: unknown) {
  const e = error as { message?: string; stack?: string } | undefined;
  try {
    fetch(`${API_BASE}/api/client-error`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where, message: String(e?.message || error).slice(0, 500), stack: String(e?.stack || "").slice(0, 2000), url: location.pathname + location.search }),
    }).catch(() => {});
  } catch {}
}

/** Keeps one broken screen from blanking the whole app. `resetKey` clears the
 * error when the student navigates elsewhere. */
export class ErrorBoundary extends Component<{ where: string; resetKey?: string; compact?: boolean; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    reportClientError(this.props.where, error);
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card card-pad stack" role="alert" style={{ alignItems: "center", textAlign: "center", margin: this.props.compact ? 12 : 0 }} data-testid="error-boundary">
        <Remy size={this.props.compact ? 40 : 56} mood="think" />
        <h3>Remy hit a snag showing this {this.props.compact ? "panel" : "page"}.</h3>
        <p className="small muted">Your work is saved. Try again, or switch pages and come back.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary btn-sm" onClick={() => this.setState({ error: null })} data-testid="button-error-retry">Try again</button>
          <button className="btn btn-secondary btn-sm" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
