import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { scrubError } from '../lib/observability/errors/scrub-error';
import { fingerprintError, isNewFingerprint } from '../lib/observability/errors/fingerprint-error';
import { getCurrentRequestId } from '../lib/observability/request-id/request-id-store';
import { BuildInfo } from '../lib/observability/build-info';
import { enqueue } from '../lib/events/event-sink';
import { ErrorFallback } from './ErrorFallback';
import type { BoundaryKind } from './ErrorFallback';

interface Props {
  readonly kind: BoundaryKind;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      const scrubbed = scrubError(error, info.componentStack ?? undefined);
      const fp = fingerprintError(scrubbed);
      if (!isNewFingerprint(fp)) return;
      const requestId = getCurrentRequestId();
      enqueue({
        type: 'client.error',
        kind: 'boundary',
        boundaryKind: this.props.kind,
        message: scrubbed.message,
        stack: scrubbed.stack,
        componentStack: scrubbed.componentStack,
        fingerprint: fp,
        requestId,
        gitSha: BuildInfo.gitSha,
      });
    } catch {
      console.error('[ErrorBoundary] componentDidCatch handler failed');
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <ErrorFallback
          kind={this.props.kind}
          requestId={getCurrentRequestId()}
          reset={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
