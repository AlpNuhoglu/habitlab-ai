export interface UrlToken {
  readonly value: string;
  readonly source: 'query' | 'fragment';
}

export function readAndStripToken(paramName = 'token'): UrlToken | null {
  const url = new URL(window.location.href);

  const fromQuery = url.searchParams.get(paramName);
  if (fromQuery) {
    url.searchParams.delete(paramName);
    // Strip token from browser history so it doesn't leak to analytics or Referer header
    history.replaceState(null, '', url.toString());
    return { value: fromQuery, source: 'query' };
  }

  const hash = url.hash.slice(1);
  const hashParams = new URLSearchParams(hash);
  const fromFragment = hashParams.get(paramName);
  if (fromFragment) {
    hashParams.delete(paramName);
    const newHash = hashParams.toString();
    history.replaceState(null, '', newHash ? `#${newHash}` : url.pathname + url.search);
    return { value: fromFragment, source: 'fragment' };
  }

  return null;
}
