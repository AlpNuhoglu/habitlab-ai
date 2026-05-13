import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AnalyticsSearchParamsSchema, type DisplayRange } from '../types';

interface UseDateRangeFromUrlReturn {
  display: DisplayRange;
  setDisplay: (next: DisplayRange) => void;
}

export function useDateRangeFromUrl(): UseDateRangeFromUrlReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawDisplay = searchParams.get('display') ?? '30d';
  const parsed = AnalyticsSearchParamsSchema.safeParse({ display: rawDisplay });
  const display: DisplayRange = parsed.success ? parsed.data.display : '30d';

  const setDisplay = useCallback(
    (next: DisplayRange) => {
      setSearchParams((prev) => {
        const next_ = new URLSearchParams(prev);
        next_.set('display', next);
        return next_;
      });
    },
    [setSearchParams],
  );

  return { display, setDisplay };
}
