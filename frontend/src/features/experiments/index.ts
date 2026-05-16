// Public surface — consumers import from here, not from internals.
export { VariantSlot } from './components/VariantSlot';
export { ExperimentsBoundary } from './components/ExperimentsBoundary';
export { OptOutToggle } from './components/OptOutToggle';
export { useVariant } from './hooks/use-variant';
export type {
  KnownExperimentKey,
  SlotId,
  AssignmentsMap,
} from './lib/slot-registry';
