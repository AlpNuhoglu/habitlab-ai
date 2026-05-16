import { enqueue } from '../../../lib/events/event-sink';
import { useSlotImpression } from '../hooks/use-slot-impression';
import { useVariant } from '../hooks/use-variant';
import type { SlotId } from '../lib/slot-registry';
import { slotRegistry } from '../lib/slot-registry';

interface VariantSlotProps {
  // Slot id — must be a registered key; typos are compile errors.
  readonly id: SlotId;
  // Fallback: rendered when experiment not running, user opted out,
  // hydration error, or variant not in registry. Children pattern matches
  // the existing placeholder API — no callsite changes needed.
  readonly children: React.ReactNode;
}

// Chrome-only primitive — wraps frontend-authored copy (page headers, button labels).
// NEVER wraps server-authoritative data (recommendation.title/body, notification copy).
export function VariantSlot({ id, children }: VariantSlotProps): React.ReactElement {
  const entry = slotRegistry[id];
  const variantKey = useVariant(entry.experimentKey);
  const ref = useSlotImpression(entry.experimentKey, variantKey, id, entry.exposureMode);

  const variants = entry.variants as Readonly<Record<string, React.ReactNode | null>>;
  const variantContent = variants[variantKey];
  const isControl = variantKey === 'control';
  const isMissing = !isControl && variantContent == null;

  if (isMissing) {
    // Backend returned an unknown variant key — the frontend hasn't shipped the render
    // function for it yet. Emit telemetry and fall back to children.
    enqueue({
      type: 'experiment.unknown_variant',
      experimentKey: entry.experimentKey,
      receivedKey: variantKey,
    });
  }

  const content = isControl || isMissing ? children : variantContent;

  if (entry.exposureMode === 'viewport' && ref) {
    return (
      <span ref={ref as React.RefObject<HTMLSpanElement>} style={{ display: 'contents' }}>
        {content}
      </span>
    );
  }

  return <>{content}</>;
}
