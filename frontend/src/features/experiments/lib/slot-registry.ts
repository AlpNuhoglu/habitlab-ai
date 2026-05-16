import type React from 'react';

// Known experiment keys — extend when a new backend experiment gets a frontend slot.
// Acts as compile-time documentation; a typo at a callsite is a type error.
export type KnownExperimentKey =
  | 'notification_copy_v1'
  | 'rec_copy_v1';

export type AssignmentsMap = Record<string, string>;

export interface SlotConfig {
  readonly experimentKey: KnownExperimentKey;
  readonly exposureMode: 'mount' | 'viewport';
  // null means "use the consumer's children (fallback)"
  readonly variants: Readonly<Record<string, React.ReactNode | null>>;
}

const slotRegistry = {
  'coach.page.title': {
    experimentKey: 'rec_copy_v1' as KnownExperimentKey,
    exposureMode: 'mount' as const,
    variants: {
      control: null,         // control → children (fallback)
      treatment: 'Your Insights',
    },
  },
  'coach.action.accept': {
    experimentKey: 'rec_copy_v1' as KnownExperimentKey,
    exposureMode: 'viewport' as const,
    variants: {
      control: null,         // control → children (fallback)
      treatment: 'Try it',
    },
  },
} satisfies Record<string, SlotConfig>;

export type SlotId = keyof typeof slotRegistry;

export { slotRegistry };

// Known keys array used by useAllAssignments — derived from the registry to stay in sync.
export const KNOWN_EXPERIMENT_KEYS: readonly KnownExperimentKey[] = [
  'notification_copy_v1',
  'rec_copy_v1',
];
