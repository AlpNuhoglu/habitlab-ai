import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { experimentKeys } from '../../../api/query-keys';
import type { KnownExperimentKey } from '../lib/slot-registry';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';
import { makeAssignmentsMap } from './fixtures';

interface VariantHarnessProps {
  readonly experimentKey: KnownExperimentKey;
  readonly variantKey: string;
  readonly children: React.ReactNode;
}

// Forces a specific variant in the QueryClient cache for Storybook / unit tests.
// Wrap the component under test with this harness to bypass the network.
export function VariantHarness({
  experimentKey,
  variantKey,
  children,
}: VariantHarnessProps): React.ReactElement {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(
      experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
      makeAssignmentsMap({ [experimentKey]: variantKey }),
    );
  }, [queryClient, experimentKey, variantKey]);

  return <>{children}</>;
}
