/**
 * Maps a normalized intensity value (0..1) to a Tailwind background class.
 * Used for heatmap-style cells.
 */
export function intensityToBgClass(intensity: number): string {
  if (intensity <= 0) return 'bg-gray-100';
  if (intensity <= 0.2) return 'bg-emerald-100';
  if (intensity <= 0.4) return 'bg-emerald-200';
  if (intensity <= 0.6) return 'bg-emerald-300';
  if (intensity <= 0.8) return 'bg-emerald-400';
  return 'bg-emerald-500';
}
