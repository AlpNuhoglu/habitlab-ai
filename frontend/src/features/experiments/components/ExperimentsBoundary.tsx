import { enqueue } from '../../../lib/events/event-sink';
import { AuthBootstrap } from '../../auth/components/AuthBootstrap';
import { useAllAssignments } from '../api/use-all-assignments';

interface ExperimentsBoundaryProps {
  readonly children: React.ReactNode;
}

// Hydrates experiment assignments before rendering authenticated routes.
// Soft-fails on error: children always render, useVariant returns 'control' everywhere.
// Never blocks the app for a failed assignment fetch.
export function ExperimentsBoundary({ children }: ExperimentsBoundaryProps): React.ReactElement {
  const { status, error } = useAllAssignments();

  if (status === 'pending') {
    return <AuthBootstrap />;
  }

  if (status === 'error') {
    const reason =
      error instanceof Error ? error.message : 'unknown';
    enqueue({ type: 'experiments.hydration_failed', reason });
    // soft-fail — render children; useVariant returns 'control' for every key
  }

  return <>{children}</>;
}
