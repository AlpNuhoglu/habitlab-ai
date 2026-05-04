interface VariantSlotProps {
  readonly id: string;
  readonly children: React.ReactNode;
}

/**
 * WP8 placeholder: renders control copy (children) until experiment variants
 * are wired in. Import VariantSlot from features/experiments in WP8 and
 * replace this component.
 */
export function VariantSlot({ children }: VariantSlotProps): React.ReactElement {
  return <>{children}</>;
}
