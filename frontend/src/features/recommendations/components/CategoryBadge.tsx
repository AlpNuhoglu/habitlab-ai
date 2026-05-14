import { CATEGORY_META } from '../lib/category-meta';
import type { RecommendationCategory } from '../types';

interface Props {
  readonly category: RecommendationCategory;
}

export function CategoryBadge({ category }: Props): React.ReactElement {
  const meta = CATEGORY_META[category];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.accentClass}`}
    >
      <span aria-hidden="true">{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
